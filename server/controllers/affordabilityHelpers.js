// server/controllers/affordabilityHelpers.js
const AffordabilityResult = require("../models/AfforadabilityResult");
const { startICHRA, getICHRA, getICHRAForMembers } = require("../services/ideon");

const IDEON_LOG = String(process.env.IDEON_LOG || "").toLowerCase() === "true";

/*
  Poll until an ICHRA calc reaches "completed"/"complete" or fails/times out.
 */
async function waitForIchraComplete(calcId, { timeoutMs = 60_000, intervalMs = 1_500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await getICHRA(calcId);
    const status = data?.ichra_affordability_calculation?.status || data?.status || "";
    const norm = String(status).toLowerCase();
    if (IDEON_LOG) console.log(">>> ICHRA poll status:", norm);
    if (norm === "completed" || norm === "complete") return data;
    if (norm === "failed") throw new Error("Ideon ICHRA calculation failed");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for Ideon ICHRA calculation");
}

/**
 * Build the start payload Ideon expects.
 * - If `rating_area_location` is a string (e.g., "work"), pass it through.
 * - Otherwise, build an object { zip_code, location_id } from the member record.
 */
function buildIchraStartPayload({
  effective_date,
  plan_year,
  member,
  rating_area_location, // can be "work" | "home" | object
}) {
  let ratingLoc;
  if (typeof rating_area_location === "string" && rating_area_location.length > 0) {
    ratingLoc = rating_area_location; // Ideon-accepted literal
  } else {
    ratingLoc = {
      zip_code: member.zip_code,
      // include Ideon location when we have it; Ideon uses it to resolve rating area
      location_id: member.location_id || undefined,
    };
  }

  return {
    ichra_affordability_calculation: {
      effective_date, // e.g. '2025-01-01'
      plan_year: plan_year || new Date(effective_date).getFullYear(),
      rating_area_location: ratingLoc,
    },
  };
}

/**
 * Try to select THIS member’s row from Ideon’s /members response 
 */
function selectTargetMemberRow(rows, member) {
  const mExt = String(member.external_id || "");

  // Prefer exact external_id match (two common shapes)
  let row =
    rows.find((r) => String(r?.member_external_id || "") === mExt) ||
    rows.find((r) => String(r?.member?.external_id || "") === mExt);

  if (row) return row;

  // Fallback: name + DOB
  const dob10 =
    member.date_of_birth && typeof member.date_of_birth.toISOString === "function"
      ? member.date_of_birth.toISOString().slice(0, 10)
      : "";
  const first = String(member.first_name || "").toLowerCase();
  const last = String(member.last_name || "").toLowerCase();

  row =
    rows.find((r) => {
      const rDob = r?.member?.date_of_birth || r?.date_of_birth || "";
      const rFirst = String(r?.member?.first_name || r?.first_name || "").toLowerCase();
      const rLast = String(r?.member?.last_name || r?.last_name || "").toLowerCase();
      return rDob === dob10 && rFirst === first && rLast === last;
    }) || rows[0];

  return row || null;
}

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map Ideon row -> our AffordabilityResult fields, defensively.
 * Falls back to plans[1] for benchmark if explicit fields aren’t present.
 */
function mapIdeonRowToAffordability({ row, groupId, memberId, effective_date }) {
  const minimum_employer_contribution = toNum(row.minimum_employer_contribution);
  const fpl_minimum_employer_contribution = toNum(row.fpl_minimum_employer_contribution);
  const premium_tax_credit = toNum(row.premium_tax_credit);

  // If benchmark not explicit, use second plan (usually SLCSP) when available
  const benchmark_plan_id =
    row.benchmark_plan_id || (row?.plans?.[1] && row.plans[1].id) || null;

  const benchmark_premium =
    toNum(row.benchmark_premium) || (row?.plans?.[1] ? toNum(row.plans[1].premium) : null);

  const affordable = typeof row.affordable === "boolean" ? row.affordable : null;

  const fpl_percent = toNum(row.fpl_percent);
  const expected_contribution = toNum(row.expected_contribution);

  return {
    group: groupId,
    member: memberId,
    minimum_employer_contribution: minimum_employer_contribution ?? null,
    fpl_minimum_employer_contribution: fpl_minimum_employer_contribution ?? null,
    premium_tax_credit: premium_tax_credit ?? null,
    benchmark_plan_id,
    benchmark_premium,
    affordable,
    fpl_percent: fpl_percent ?? null,
    expected_contribution: expected_contribution ?? null,
    effective_date,
    source: "ideon",
    raw_json: row,
  };
}

/**
 * Start group ICHRA calc, wait, fetch member rows, upsert AffordabilityResult for THIS member.
 * Return the saved doc (lean) or null.
 *
 * Options supports `rating_area_location` override (e.g., "work").
 */
async function ensureIdeonAffordability({ group, member, effective_date, rating_area_location }) {
  try {
    if (!process.env.IDEON_API_KEY) return null;

    const startPayload = buildIchraStartPayload({
      effective_date,
      plan_year: group?.plan_year_start ? new Date(group.plan_year_start).getFullYear() : undefined,
      member,
      rating_area_location,
    });

    const groupIdentifier = group.ideon_group_id || group.external_id || String(group._id);

    if (IDEON_LOG) console.log(">>> Starting ICHRA with:", { groupIdentifier, startPayload });

    // Start calc
    const { data: started } = await startICHRA(groupIdentifier, startPayload);
    const calcId = started?.ichra_affordability_calculation?.id || started?.id;
    if (!calcId) throw new Error("Ideon did not return calculation id");
    if (IDEON_LOG) console.log(">>> ICHRA started:", calcId);

    // Wait for completion
    await waitForIchraComplete(calcId);

    // Fetch member-level results
    const { data: membersPayload } = await getICHRAForMembers(calcId);
    const rows = Array.isArray(membersPayload?.members)
      ? membersPayload.members
      : Array.isArray(membersPayload)
      ? membersPayload
      : [];

    if (!rows.length) throw new Error("No member results returned by Ideon");
    if (IDEON_LOG) console.log(">>> /members first row:", rows[0]);

    const target = selectTargetMemberRow(rows, member);
    if (!target) throw new Error("Could not map Ideon member result to our member");
    if (IDEON_LOG) console.log(">>> matched member row:", target);

    const mapped = mapIdeonRowToAffordability({
      row: target,
      groupId: group._id,
      memberId: member._id,
      effective_date,
    });

    const saved = await AffordabilityResult.findOneAndUpdate(
      { group: group._id, member: member._id },
      { $set: mapped },
      { upsert: true, new: true }
    ).lean();

    if (IDEON_LOG) console.log(">>> AffordabilityResult upserted:", saved?._id);

    return saved;
  } catch (err) {
    console.error(">>> ensureIdeonAffordability error:", err?.response?.data || err);
    return null;
  }
}

module.exports = { ensureIdeonAffordability };