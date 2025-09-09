// server/controllers/affordabilityHelpers.js
const AffordabilityResult = require("../models/AfforadabilityResult"); // 
const { startICHRA, getICHRA, getICHRAForMembers } = require("../services/ideon");

// Small polling utility
async function waitForIchraComplete(calcId, { timeoutMs = 60000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await getICHRA(calcId);
    // Ideon usually returns: 'queued' | 'processing' | 'completed' | 'failed'
    const status = data?.ichra_affordability_calculation?.status || data?.status;
    if (status === "completed") return data;
    if (status === "failed") throw new Error("Ideon ICHRA calculation failed");
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for Ideon ICHRA calculation");
}

// Build the payload Ideon expects for starting an ICHRA calc.
function buildIchraStartPayload({ effective_date, plan_year, member /*, group*/ }) {
  const rating_area_location = {
    zip_code: member.zip_code,
    location_id: member.location_id || undefined, //  if  store an Ideon location id
  };

  return {
    ichra_affordability_calculation: {
      effective_date, // 'YYYY-MM-DD'
      plan_year: plan_year || new Date(effective_date).getFullYear(),
      rating_area_location,
    },
  };
}

/**
 * ensureIdeonAffordability()
 * Kicks off an ICHRA affordability calc for the GROUP, waits for it,
 * pulls member-level results, and upserts AffordabilityResult for the member.
 * Returns the saved AffordabilityResult (lean) OR null if anything fails.
 */
async function ensureIdeonAffordability({ group, member, effective_date }) {
  try {
    // If there’s no API key configured, just skip (controller will fall back)
    if (!process.env.IDEON_API_KEY) return null;

    // Start calc for the whole group
    const startPayload = buildIchraStartPayload({
      effective_date,
      plan_year: group?.plan_year_start ? new Date(group.plan_year_start).getFullYear() : undefined,
      member,
      group,
    });

    // NOTE: Depending on your integration, startICHRA may want the Ideon group id,
    // or your external id. Adjust this argument if needed.
    const groupIdentifier = group.ideon_group_id || group.external_id || String(group._id);
    const { data: started } = await startICHRA(groupIdentifier, startPayload);
    const calcId = started?.ichra_affordability_calculation?.id || started?.id;
    if (!calcId) throw new Error("Ideon did not return calculation id");

    // Poll to completion
    await waitForIchraComplete(calcId);

    // Fetch member-level results
    const { data: list } = await getICHRAForMembers(calcId);
    const rows = Array.isArray(list?.members) ? list.members : list;
    if (!rows || !rows.length) throw new Error("No member results returned by Ideon");

    // Try to match this member (best if you send external_id to Ideon when creating members)
    const target =
      rows.find(r => String(r?.member?.external_id || "") === String(member.external_id || "")) ||
      rows.find(r =>
        (r?.member?.date_of_birth === (member.date_of_birth?.toISOString?.().slice(0,10) || "")) &&
        (r?.member?.first_name || "").toLowerCase() === (member.first_name || "").toLowerCase() &&
        (r?.member?.last_name || "").toLowerCase() === (member.last_name || "").toLowerCase()
      ) ||
      rows[0];

    if (!target) throw new Error("Could not map Ideon member result to our member");

    // Map fields we care about (tweak names if your tenant differs)
    const mapped = {
      group: group._id,
      member: member._id,
      fpl_percent: target.fpl_percent ?? null,
      expected_contribution: target.expected_contribution ?? null, // usually monthly
      benchmark_plan_id: target.benchmark_plan_id ?? null,
      benchmark_premium: target.benchmark_premium ?? null,
      premium_tax_credit: target.premium_tax_credit ?? null,
      affordable: target.affordable ?? null,
      effective_date,
      source: "ideon",
      raw_json: target,
    };

    const saved = await AffordabilityResult.findOneAndUpdate(
      { group: group._id, member: member._id },
      { $set: mapped },
      { upsert: true, new: true }
    ).lean();

    return saved;
  } catch (err) {
    console.error(">>> ensureIdeonAffordability error:", err?.response?.data || err);
    return null; // non-fatal; quoting can proceed without Ideon
  }
}

module.exports = { ensureIdeonAffordability };