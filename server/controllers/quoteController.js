// Collections used (models):
// - Group            : employer groups
// - Member           : employees (date_of_birth, zip_code, tobacco, etc.)
// - ZipCounty        : map ZIP -> county_id (CSV: zip_counties.csv)
// - PlanCounty       : map county_id -> plan_id (CSV: plan_counties.csv)
// - Pricing          : plan premiums by (plan_id, age, tobacco) (CSV: pricings.csv)
// - Plan             : plan metadata (CSV: plans.csv)
// - QuoteResult      : persisted quote batches per group run

// server/controllers/quoteController.js
const Group = require("../models/Group");
const Member = require("../models/Member");

// const AffordabilityResult = require("../models/AffordabilityResult");
const { ensureIdeonAffordability } = require("../controllers/affordabilityHelpers.js");
const Pricing = require("../models/Pricing");
const Plan = require("../models/Plan");
const ICHRAClass = require("../models/ICHRAClass");
const PlanCounty = require("../models/PlanCounties");
const ZipCounty = require("../models/ZipCounties");
const QuoteResult = require("../models/QuoteResult");
const { getFpl, applicablePct, expectedContributionMonthly } = require("../lib/premiumTaxCredit");

// ---------------- helpers ----------------

function calcAge(dob, effectiveDateStr) {
  if (!dob) return null;
  const today = effectiveDateStr ? new Date(effectiveDateStr) : new Date();
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

// Return unique county_ids for a 5-digit ZIP (string or number).
async function countiesForZip(zip5) {
  if (!zip5) return [];
  const zstr = String(zip5).trim().slice(0, 5);
  const znum = Number(zstr);

  const rows = await ZipCounty.find({
    $or: [{ zip_code_id: zstr }, { zip_code_id: znum }],
  })
    .select({ county_id: 1, _id: 0 })
    .lean();

  return Array.from(new Set(rows.map((r) => String(r.county_id))));
}

// Trim + dedupe plans for the API response
function transformQuoteDoc(doc) {
  return {
    _id: doc._id,
    group: doc.group?._id
      ? {
          _id: doc.group._id,
          company_name: doc.group.company_name,
          contact_name: doc.group.contact_name,
          contact_email: doc.group.contact_email,
        }
      : doc.group,
    quotes: doc.quotes.map((q) => {
      // Dedupe plans by plan_id, keep only sane entries
      const dedupedPlans = Array.from(
        new Map(
          (q.quotes || [])
            .filter(
              (plan) =>
                plan &&
                plan.plan_details &&
                plan.plan_details.carrier_name &&
                (plan.plan_details.display_name || plan.plan_details.name)
            )
            .map((plan) => [
              plan.plan_id,
              {
                plan_id: plan.plan_id,
                premium: plan.premium,
                adjusted_cost: plan.adjusted_cost,
                benchmark_plan_id: plan.benchmark_plan_id,
                benchmark_premium: plan.benchmark_premium,
                plan_details: {
                  carrier_name: plan.plan_details.carrier_name,
                  display_name:
                    plan.plan_details.display_name || plan.plan_details.name || null,
                  plan_type: plan.plan_details.plan_type,
                  level: plan.plan_details.level,
                },
              },
            ])
        ).values()
      );

      const memberBlock = q.member?._id
        ? {
            _id: q.member._id,
            first_name: q.member.first_name,
            last_name: q.member.last_name,
            date_of_birth: q.member.date_of_birth,
            zip_code: q.member.zip_code,
            tobacco: q.member.tobacco,
          }
        : q.member;

      const affordabilityBlock = q.affordability
        ? {
            fpl_percent: q.affordability.fpl_percent,
            expected_contribution: q.affordability.expected_contribution,
            benchmark_plan_id: q.affordability.benchmark_plan_id,
            benchmark_premium: q.affordability.benchmark_premium,
            premium_tax_credit: q.affordability.premium_tax_credit,
            affordable: q.affordability.affordable,
          }
        : null;

      return {
        member: memberBlock,
        affordability: affordabilityBlock,
        meta: q.meta || null,
        quotes: dedupedPlans,
      };
    }),
    createdAt: doc.createdAt,
  };
}

// --- On-market SLCSP (Benchmark) helper -------------------------------------
async function computeBenchmarkSilver({ countyId, age, tobacco }) {
  const county_id = String(countyId);

  // 1) All plans in county
  const planCountyRows = await PlanCounty.find({ county_id })
    .select({ plan_id: 1, _id: 0 })
    .lean();
  const planIds = Array.from(new Set(planCountyRows.map((r) => r.plan_id)));
  if (!planIds.length) {
    return { error: `No plans in county_id ${county_id}` };
  }

  // 2) On-market Silver plans
  const silverPlans = await Plan.find({
    plan_id: { $in: planIds },
    on_market: true,
    level: /silver/i,
  })
    .select({
      plan_id: 1,
      carrier_name: 1,
      display_name: 1,
      name: 1,
      plan_type: 1,
      level: 1,
    })
    .lean();

  if (!silverPlans.length) {
    return { error: `No on-market Silver plans in county_id ${county_id}` };
  }

  // 3) Pricing   age+tobacco across those silver plans
  const silverIds = silverPlans.map((p) => p.plan_id);
  const pricingRows = await Pricing.find({
    plan_id: { $in: silverIds },
    age,
    tobacco: !!tobacco,
  })
    .select({ plan_id: 1, premium: 1, _id: 0 })
    .lean();

  if (!pricingRows.length) {
    return {
      error: `No pricing for Silver plans at age ${age} (tobacco=${!!tobacco})`,
    };
  }

  const premByPlan = new Map(
    pricingRows.map((p) => [p.plan_id, Number(p.premium)])
  );

  // 4) Merge plan meta + premium, filter out missing premiums, rank ascending
  const ranked = silverPlans
    .map((p) => ({
      plan_id: p.plan_id,
      premium: premByPlan.get(p.plan_id),
      carrier_name: p.carrier_name,
      display_name: p.display_name || p.name || null,
      plan_type: p.plan_type,
      level: p.level,
    }))
    .filter((x) => Number.isFinite(x.premium))
    .sort((a, b) => a.premium - b.premium);

  if (!ranked.length) {
    return {
      error: `No priced Silver plans after filtering (age ${age}, tobacco=${!!tobacco})`,
    };
  }

  // 5) Pick SLCSP: index 1 if available, else index 0 fallback
  const idx = ranked.length >= 2 ? 1 : 0;
  const chosen = ranked[idx];

  return {
    benchmark_plan_id: chosen.plan_id,
    benchmark_premium: chosen.premium,
    slcsp_rank: idx + 1,
    silver_candidates: ranked,
  };
}

// -------------------- Controllers --------------------

// POST /api/groups/:groupId/quotes
// Generates a batch of quotes for ALL members in the group (on-market subsidy applied; off-market full price)
exports.generateQuotes = async (req, res) => {
  const { groupId } = req.params;
  const { effective_date, tobacco, rating_area_location } = req.body || {}; // include rating_area_location
  console.log(">>> Inside generateQuotes for group:", groupId);

  try {
    const group = await Group.findById(groupId).populate("classes");
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = await Member.find({ group: groupId });
    if (!members.length) return res.status(404).json({ error: "No members found in group" });

    // Normalize rating_area_location for Ideon (string "work"/"home" or object). Default "work".
    const ratingLoc = (typeof rating_area_location !== "undefined") ? rating_area_location : "work";

    const batchQuotes = [];

    for (const member of members) {
      // --- Member prerequisites
      if (!member.zip_code) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: { skipped: true, reason: "Missing member.zip_code" },
          quotes: [],
        });
        continue;
      }
      if (!member.date_of_birth) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: { skipped: true, reason: "Missing member.date_of_birth" },
          quotes: [],
        });
        continue;
      }

      const age = calcAge(member.date_of_birth, effective_date);
      if (age == null) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: { skipped: true, reason: "Could not compute age from date_of_birth" },
          quotes: [],
        });
        continue;
      }

      const isTobacco =
        typeof tobacco === "boolean" ? tobacco : member.tobacco ?? false;

      // --- ZIP -> county(s)
      const countyIds = await countiesForZip(member.zip_code);
      if (countyIds.length === 0) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: { skipped: true, reason: `No counties for ZIP ${member.zip_code}` },
          quotes: [],
        });
        continue;
      }

      // --- Choose a county: override -> member.fips_code -> unique -> else ask UI
      let selectedCountyId = null;
      let countySource = null;

      if (req.body && req.body.county_id) {
        selectedCountyId = String(req.body.county_id);
        countySource = "override";
      } else if (member.fips_code) {
        selectedCountyId = String(member.fips_code);
        countySource = "member_fips";
      } else if (countyIds.length === 1) {
        selectedCountyId = countyIds[0];
        countySource = "unique_from_zip";
      }

      if (!selectedCountyId) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: {
            skipped: true,
            reason: "ZIP maps to multiple counties—UI must choose one",
            zip_code: member.zip_code,
            county_ids: countyIds,
          },
          quotes: [],
        });
        continue;
      }

      const countyId = selectedCountyId;

      // --- Plans in county
      const planCountyRows = await PlanCounty.find({ county_id: countyId })
        .select({ plan_id: 1, _id: 0 })
        .lean();
      const planIds = Array.from(new Set(planCountyRows.map((r) => r.plan_id)));
      if (!planIds.length) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: { skipped: true, reason: `No plans in county_id ${countyId}` },
          quotes: [],
        });
        continue;
      }

      // --- Pricing for (plan, age, tobacco)
      const pricingRows = await Pricing.find({
        plan_id: { $in: planIds },
        age,
        tobacco: isTobacco,
      })
        .select({ plan_id: 1, premium: 1, _id: 0 })
        .lean();
      if (!pricingRows.length) {
        batchQuotes.push({
          member: member._id,
          affordability: null,
          meta: {
            skipped: true,
            reason: `No pricing for age ${age} (tobacco=${isTobacco})`,
          },
          quotes: [],
        });
        continue;
      }

      const priceByPlan = new Map(
        pricingRows.map((p) => [p.plan_id, Number(p.premium)])
      );
      const pricedPlanIds = planIds.filter((pid) => priceByPlan.has(pid));

      // --- Plan details
      const plans = await Plan.find({ plan_id: { $in: pricedPlanIds } })
        .select({
          plan_id: 1,
          name: 1,
          display_name: 1,
          carrier_name: 1,
          level: 1,
          plan_type: 1,
          on_market: 1,
          off_market: 1,
          network_name: 1,
          summary_of_benefits_url: 1,
        })
        .lean();

      // --- Ideon (Option B): get affordability / PTC if possible
      let ichra = null;
      try {
        ichra = await ensureIdeonAffordability({
          group,
          member,
          effective_date: req.body?.effective_date || new Date().toISOString().slice(0, 10), // 'YYYY-MM-DD'
          rating_area_location: ratingLoc, //  pass along to the helper
        });
      } catch (e) {
        console.warn(
          "ensureIdeonAffordability failed (continuing):",
          e?.message || e
        );
      }

      // --- Compute subsidy: prefer Ideon PTC; else fall back to internal SLCSP/FPL math
      // Prefer Ideon PTC; otherwise bench - expected. Expose %FPL & expected in response.
       let subsidyMonthly = 0;
       let benchPlanId = ichra?.benchmark_plan_id ?? null;
       let benchPremium = Number(ichra?.benchmark_premium ?? NaN);
       let fplAnnual = null;
       let fplPercent = null;
       let expectedMonthly = null;
 
       // MAGI block (used even if Ideon returns PTC, so we can surface %FPL/expected)
       const magi =
         (member.agi ?? 0) +
         (member.nontaxable_social_security ?? 0) +
         (member.tax_exempt_interest ?? 0) +
         (member.foreign_earned_income ?? 0);
       const taxYear = member.tax_year || 2025;
       const stateCode = (member.state_code || "").toUpperCase(); // 'AK'|'HI'|'' => 48/DC
       try {
         fplAnnual = getFpl(taxYear, member.household_size || 1, stateCode);
         fplPercent = fplAnnual > 0 ? (magi / fplAnnual) * 100 : 0;
         expectedMonthly = expectedContributionMonthly(magi, fplPercent);
       } catch {
         // leave as nulls if FPL table not available
       }
 
       // Ensure  have a benchmark; if Ideon didn’t give one, use internal SLCSP
       if (!Number.isFinite(benchPremium) || !benchPlanId) {
         const bench = await computeBenchmarkSilver({
           countyId: countyId,
           age,
           tobacco: isTobacco,
         });
         if (!bench.error) {
           benchPlanId = bench.benchmark_plan_id;
           benchPremium = Number(bench.benchmark_premium);
         }
       }
 
       // Subsidy
       if (ichra && Number.isFinite(Number(ichra.premium_tax_credit))) {
         subsidyMonthly = Number(ichra.premium_tax_credit);
       } else if (Number.isFinite(benchPremium) && Number.isFinite(expectedMonthly ?? NaN)) {
         subsidyMonthly = Math.max(0, benchPremium - expectedMonthly);
       } else {
         subsidyMonthly = 0;
       }

       // --- Derive affordable if helper didn't provide it
       const shi = member.safe_harbor_income;
        const affordableVal =
        (typeof ichra?.affordable === "boolean")
          ? ichra.affordable
          : (
              Number.isFinite(Number(ichra?.minimum_employer_contribution)) &&
              Number.isFinite(Number((shi)))
                ? Number(ichra.minimum_employer_contribution) <= Number(shi)
                : null
            );

      // --- Apply subsidy ONLY to ON-MARKET plans; off-market stays full price
      const quotes = plans
        .map((pl) => {
          const premium = priceByPlan.get(pl.plan_id);
          const net = pl.on_market ? Math.max(0, premium - subsidyMonthly) : premium;

          return {
            plan_id: pl.plan_id,
            premium,
            adjusted_cost: Math.round(net * 100) / 100,
            benchmark_plan_id: benchPlanId ?? null,
            benchmark_premium: Number.isFinite(benchPremium) ? benchPremium : null,
            plan_details: pl,
          };
        })
        .sort((a, b) => a.adjusted_cost - b.adjusted_cost);

      // --- Push one member’s bundle into the batch
      batchQuotes.push({
        member: member._id,
        affordability: {
          // Prefer Ideon values if provided; otherwise show our computed ones
          fpl_percent:
            (ichra?.fpl_percent ?? null) ??
            (fplPercent == null ? null : Math.round(fplPercent)),
          expected_contribution:
            (ichra?.expected_contribution ?? null) ??
            (expectedMonthly == null ? null : Math.round(expectedMonthly * 100) / 100),
          benchmark_plan_id: benchPlanId ?? ichra?.benchmark_plan_id ?? null,
          benchmark_premium:
            Number.isFinite(benchPremium) ? benchPremium : (ichra?.benchmark_premium ?? null),
          premium_tax_credit: ichra?.premium_tax_credit ?? subsidyMonthly ?? null,
          affordable: affordableVal, //edit this to show in api call
        },
        meta: {
          zip_code: member.zip_code,
          county_id: countyId,
          county_source: countySource,
          age,
          tobacco: isTobacco,
        },
        quotes,
      });
    } // <<--- end for (const member of members)

    // --- Save the batch and respond
    const quoteDoc = new QuoteResult({
      group: groupId,
      quotes: batchQuotes,
      raw_context: { memberCount: members.length },
    });
    await quoteDoc.save();

    const populated = await QuoteResult.findById(quoteDoc._id)
      .populate("group", "company_name contact_name contact_email")
      .populate(
        "quotes.member",
        "first_name last_name date_of_birth zip_code tobacco"
      )
      .lean();

    return res.json({
      message: "Quotes generated",
      result: transformQuoteDoc(populated),
    });
  } catch (err) {
    console.error(">>> Error generating quotes:", err);
    return res.status(500).json({ error: "Failed to generate quotes" });
  }
};

// GET /api/groups/:groupId/quotes → latest batch
exports.getLatestQuotes = async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await QuoteResult.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate(
        "quotes.member",
        "first_name last_name date_of_birth zip_code tobacco"
      );

    if (!result) return res.status(404).json({ error: "No quotes found" });
    return res.json(transformQuoteDoc(result));
  } catch (err) {
    console.error(">>> Error fetching latest quotes:", err);
    return res.status(500).json({ error: "Failed to fetch quotes" });
  }
};

// --- History ---
// GET /api/groups/:groupId/quotes/history → all batches
exports.getQuoteHistory = async (req, res) => {
  const { groupId } = req.params;
  try {
    const results = await QuoteResult.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate(
        "quotes.member",
        "first_name last_name date_of_birth zip_code tobacco"
      );

    return res.json(results.map(transformQuoteDoc));
  } catch (err) {
    console.error(">>> Error fetching quote history:", err);
    return res.status(500).json({ error: "Failed to fetch quote history" });
  }
};

// POST /api/groups/:groupId/quotes/preview
// Body: { member_id, county_id, effective_date?, tobacco?, state_code? }
// Returns quotes for ONE member in ONE selected county. Does NOT save a QuoteResult.
exports.previewMemberQuotes = async (req, res) => {
  const { groupId } = req.params;
  const { member_id, county_id, effective_date, tobacco, state_code } = req.body || {};

  try {
    if (!member_id) return res.status(400).json({ error: "member_id is required" });
    if (!county_id) return res.status(400).json({ error: "county_id is required (choose one)" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = await Member.findById(member_id).lean();
    if (!member || String(member.group) !== String(groupId)) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    if (!member.date_of_birth) {
      return res.status(400).json({ error: "Member is missing date_of_birth" });
    }

    const age = calcAge(member.date_of_birth, effective_date);
    if (age == null) return res.status(400).json({ error: "Could not compute member age" });

    const isTobacco = (typeof tobacco === "boolean") ? tobacco : (member.tobacco ?? false);

    // Plans in selected county
    const planCountyRows = await PlanCounty.find({ county_id: String(county_id) })
      .select({ plan_id: 1, _id: 0 })
      .lean();
    const planIds = Array.from(new Set(planCountyRows.map((r) => r.plan_id)));
    if (!planIds.length) {
      return res.json({
        member: { _id: member._id, first_name: member.first_name, last_name: member.last_name },
        meta: { county_id, reason: `No plans in county_id ${county_id}` },
        quotes: []
      });
    }

    // Pricing for (plan, age, tobacco)
    const pricingRows = await Pricing.find({
      plan_id: { $in: planIds },
      age,
      tobacco: isTobacco,
    })
      .select({ plan_id: 1, premium: 1, _id: 0 })
      .lean();

    if (!pricingRows.length) {
      return res.json({
        member: { _id: member._id, first_name: member.first_name, last_name: member.last_name },
        meta: { county_id, reason: `No pricing for age ${age} (tobacco=${isTobacco})` },
        quotes: []
      });
    }

    const priceByPlan = new Map(pricingRows.map((p) => [p.plan_id, Number(p.premium)]));
    const pricedPlanIds = planIds.filter((pid) => priceByPlan.has(pid));

    // Plan details (need on_market flag)
    const plans = await Plan.find({ plan_id: { $in: pricedPlanIds } })
      .select({
        plan_id: 1,
        name: 1,
        display_name: 1,
        carrier_name: 1,
        level: 1,
        plan_type: 1,
        on_market: 1,
        off_market: 1,
        network_name: 1,
        summary_of_benefits_url: 1,
      })
      .lean();

    // --- Compute benchmark + subsidy (Steps 1–5) ---
    const bench = await computeBenchmarkSilver({
      countyId: county_id,
      age,
      tobacco: isTobacco,
    });

    // Default subsidy = 0 if we cannot compute benchmark or MAGI/FPL inputs are missing
    let subsidyMonthly = 0;
    let expectedMonthly = 0;
    let fpl = null;
    let fplPercent = null;
    let appPct = null;

    if (!bench.error) {
      // MAGI
      const magi =
        (member.agi ?? 0) +
        (member.nontaxable_social_security ?? 0) +
        (member.tax_exempt_interest ?? 0) +
        (member.foreign_earned_income ?? 0);

      const taxYear = member.tax_year || 2025;
      try {
        // FPL + %FPL
        fpl = getFpl(taxYear, member.household_size || 1, state_code);
        fplPercent = fpl > 0 ? (magi / fpl) * 100 : 0;

        // Applicable % and expected contribution
        appPct = applicablePct(fplPercent);
        expectedMonthly = expectedContributionMonthly(magi, fplPercent);

        // Subsidy = max(0, benchmark - expected)
        subsidyMonthly = Math.max(0, Number(bench.benchmark_premium) - expectedMonthly);
      } catch {
        // keep subsidy at 0 if FPL table not available
      }
    }

    // Build quotes applying subsidy only to on-market plans
    const quotes = plans
      .map((pl) => {
        const premium = priceByPlan.get(pl.plan_id);
        const net = pl.on_market ? Math.max(0, premium - subsidyMonthly) : premium;

        return {
          plan_id: pl.plan_id,
          premium,
          net_premium: Math.round(net * 100) / 100,
          plan_details: pl,
        };
      })
      .sort((a, b) => a.net_premium - b.net_premium);

    // Response
    return res.json({
      member: {
        _id: member._id,
        first_name: member.first_name,
        last_name: member.last_name,
        date_of_birth: member.date_of_birth,
        zip_code: member.zip_code,
        tobacco: member.tobacco ?? false,
      },
      meta: {
        county_id: String(county_id),
        age,
        tobacco: isTobacco,
      },
      benchmark: bench.error
        ? null
        : {
            plan_id: bench.benchmark_plan_id,
            premium: Number(bench.benchmark_premium),
            slcsp_rank: bench.slcsp_rank,
          },
      subsidy: {
        monthly: Math.round(subsidyMonthly * 100) / 100,
        expected_contribution_monthly: Math.round(expectedMonthly * 100) / 100,
        applicable_percentage:
          appPct == null ? null : Math.round(appPct * 1000) / 10, // e.g. 8.5
        fpl_annual: fpl,
        fpl_percent: fplPercent == null ? null : Math.round(fplPercent),
      },
      quotes,
    });
  } catch (err) {
    console.error(">>> Error in previewMemberQuotes:", err);
    return res.status(500).json({ error: "Failed to preview quotes" });
  }
};

// POST /api/groups/:groupId/quotes/benchmark
// Body: { member_id, county_id, effective_date?, tobacco?, state_code? }
// → Computes SLCSP (benchmark) + subsidy math for that member in that county (no DB writes).
exports.benchmarkForMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { member_id, county_id, effective_date, tobacco, state_code } = req.body || {};

    if (!member_id || !county_id) {
      return res.status(400).json({ error: "member_id and county_id are required" });
    }

    const member = await Member.findById(member_id).lean();
    if (!member || String(member.group) !== String(groupId)) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    if (!member.date_of_birth) {
      return res.status(400).json({ error: "Member missing date_of_birth" });
    }

    const age = calcAge(member.date_of_birth, effective_date);
    if (age == null) {
      return res.status(400).json({ error: "Could not compute age from date_of_birth" });
    }

    const isTobacco = (typeof tobacco === "boolean") ? tobacco : (member.tobacco ?? false);

    // ---- Find SLCSP (benchmark) ----
    const bench = await computeBenchmarkSilver({
      countyId: county_id,
      age,
      tobacco: isTobacco,
    });
    if (bench.error) {
      return res.status(400).json({ error: bench.error });
    }

    // ---- Steps 1–4: MAGI → %FPL → applicable % → expected contribution → subsidy ----

    // Step 1: MAGI (annual)
    const magi =
      (member.agi ?? 0) +
      (member.nontaxable_social_security ?? 0) +
      (member.tax_exempt_interest ?? 0) +
      (member.foreign_earned_income ?? 0);

    // Step 2: FPL lookup
    const taxYear = member.tax_year || 2025;
    const hhSize = member.household_size || 1;
    const stateCode = (state_code || member.state_code || "").toUpperCase(); // 'AK'|'HI'|''(48/DC)

    let fpl = 0,
      fplPercent = 0,
      applicablePctVal = 0,
      expectedMonthly = 0,
      expectedAnnual = 0,
      subsidyMonthly = 0;

    try {
      fpl = getFpl(taxYear, hhSize, stateCode);
      fplPercent = fpl > 0 ? (magi / fpl) * 100 : 0;

      // Step 3: Applicable % from sliding scale
      applicablePctVal = applicablePct(fplPercent); // decimal, e.g. 0.085

      // Step 4: Expected contribution (annual & monthly)
      expectedAnnual = (Number(magi) || 0) * applicablePctVal;
      expectedMonthly = expectedAnnual / 12;

      // Subsidy = benchmark - expected monthly contribution
      subsidyMonthly = Math.max(0, Number(bench.benchmark_premium) - expectedMonthly);
    } catch (e) {
      // If FPL not configured for taxYear (or other calc error), return benchmark but no subsidy
      return res.json({
        member: {
          _id: member._id,
          first_name: member.first_name,
          last_name: member.last_name,
          date_of_birth: member.date_of_birth,
          zip_code: member.zip_code,
          tobacco: isTobacco,
        },
        meta: { county_id: String(county_id), age, tobacco: isTobacco },
        benchmark: {
          plan_id: bench.benchmark_plan_id,
          premium: Number(bench.benchmark_premium),
          slcsp_rank: bench.slcsp_rank,
        },
        subsidy: {
          error: e.message || "FPL not available for provided tax_year",
          magi,
          fpl_annual: null,
          fpl_percent: null,
          applicable_percentage: null,
          expected_contribution_monthly: null,
          expected_contribution_annual: null,
          monthly: 0,
          tax_year: taxYear,
          household_size: hhSize,
          state_code: stateCode || "48",
        },
        silver_candidates: bench.silver_candidates,
      });
    }

    // Add net premiums to the Silver list (optional but handy)
    const silverWithNet = (bench.silver_candidates || []).map((p) => ({
      ...p,
      net_premium: Math.max(0, Number(p.premium) - subsidyMonthly),
    }));

    // ---- Response ----
    return res.json({
      member: {
        _id: member._id,
        first_name: member.first_name,
        last_name: member.last_name,
        date_of_birth: member.date_of_birth,
        zip_code: member.zip_code,
        tobacco: isTobacco,
      },
      meta: {
        county_id: String(county_id),
        age,
        tobacco: isTobacco,
      },
      benchmark: {
        plan_id: bench.benchmark_plan_id,
        premium: Number(bench.benchmark_premium),
        slcsp_rank: bench.slcsp_rank,
      },
      subsidy: {
        monthly: Math.round(subsidyMonthly * 100) / 100,
        expected_contribution_monthly: Math.round(expectedMonthly * 100) / 100,
        expected_contribution_annual: Math.round(expectedAnnual * 100) / 100, // Step 4
        applicable_percentage: Math.round(applicablePctVal * 1000) / 10, // e.g. 0.085 → 8.5
        magi,
        fpl_annual: fpl,
        fpl_percent: Math.round(fplPercent),
        tax_year: taxYear,
        household_size: hhSize,
        state_code: stateCode || "48",
      },
      silver_candidates: silverWithNet,
    });
  } catch (err) {
    console.error(">>> Error benchmarkForMember:", err);
    return res.status(500).json({ error: "Failed to compute benchmark" });
  }
};



// --- Employer Comparison summary (monthly + annual) --------------------------
exports.employerSummary = async (req, res) => {
  const { groupId } = req.params;

  try {
    // 1) Load group (we only need id + name here)
    const group = await Group.findById(groupId).select("_id company_name classes").lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    // 2) Load members with fields we need (include dependents!)
    const members = await Member.find({ group: groupId })
      .select({
        ichra_class: 1,
        old_employer_contribution: 1,
        dependents: 1,
        first_name: 1,
        last_name: 1,
      })
      .lean();

    // 3) Old employer monthly total
    const oldMonthlyTotal = members.reduce(
      (sum, m) => sum + (Number(m.old_employer_contribution) || 0),
      0
    );

    // 4) Build class map { classId -> {name, emp, dep} }
    //    Prefer querying classes by ids (robust even if group.classes isn't populated)
    const classIds = [
      ...new Set(members.map(m => m.ichra_class).filter(Boolean).map(String)),
    ];
    let classes = [];
    if (classIds.length) {
      classes = await ICHRAClass.find({ _id: { $in: classIds } })
        .select("name employee_contribution dependent_contribution")
        .lean();
    }
    const classMap = new Map(
      classes.map(c => [
        String(c._id),
        {
          name: c.name || null,
          employee_contribution: Number(c.employee_contribution) || 0,
          dependent_contribution: Number(c.dependent_contribution) || 0,
        },
      ])
    );

    // 5) Sum ICHRA monthly using employee + dependents * dependent_contribution
    let newMonthlyTotal = 0;
    const byClass = {}; // breakdown

    for (const m of members) {
      const cid = m.ichra_class ? String(m.ichra_class) : null;
      if (!cid || !classMap.has(cid)) continue;

      const cls = classMap.get(cid);
      const depCount = Array.isArray(m.dependents) ? m.dependents.length : 0;
      const amount = cls.employee_contribution + depCount * cls.dependent_contribution;

      newMonthlyTotal += amount;

      if (!byClass[cid]) {
        byClass[cid] = {
          name: cls.name,
          count: 0,
          monthlyTotal: 0,
        };
      }
      byClass[cid].count += 1;
      byClass[cid].monthlyTotal += amount;
    }

    // 6) Annualize + savings
    const oldAnnualTotal = oldMonthlyTotal * 12;
    const newAnnualTotal = newMonthlyTotal * 12;

    const monthlySavings = oldMonthlyTotal - newMonthlyTotal;
    const annualSavings = oldAnnualTotal - newAnnualTotal;

    return res.json({
      group: { _id: group._id, company_name: group.company_name },
      counts: {
        members: members.length,
        classes: new Set(classIds).size,
        members_with_class: Object.values(byClass).reduce((n, x) => n + x.count, 0),
      },
      employer_comparison: {
        old: {
          monthly_total: Math.round(oldMonthlyTotal * 100) / 100,
          annual_total: Math.round(oldAnnualTotal * 100) / 100,
        },
        ichra: {
          monthly_total: Math.round(newMonthlyTotal * 100) / 100,
          annual_total: Math.round(newMonthlyTotal * 12 * 100) / 100,
        },
        savings: {
          monthly: Math.round((oldMonthlyTotal - newMonthlyTotal) * 100) / 100,
          annual: Math.round((oldAnnualTotal - newAnnualTotal) * 100) / 100,
        },
      },
      breakdown_by_class: Object.fromEntries(
        Object.entries(byClass).map(([id, v]) => [
          id,
          {
            name: v.name,
            members: v.count,
            monthly_total: Math.round(v.monthlyTotal * 100) / 100,
            annual_total: Math.round(v.monthlyTotal * 12 * 100) / 100,
          },
        ])
      ),
    });
  } catch (err) {
    console.error(">>> employerSummary error:", err);
    return res.status(500).json({ error: "Failed to compute employer comparison" });
  }
};