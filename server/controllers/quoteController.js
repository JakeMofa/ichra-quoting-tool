// Collections used (models):
// - Group            : employer groups
// - Member           : employees (date_of_birth, zip_code, tobacco, etc.)
// - AffordabilityResult : latest Ideon (or fallback) affordability outcomes
// - ZipCounty        : map ZIP -> county_id (CSV: zip_counties.csv)
// - PlanCounty       : map county_id -> plan_id (CSV: plan_counties.csv)
// - Pricing          : plan premiums by (plan_id, age, tobacco) (CSV: pricings.csv)
// - Plan             : plan metadata (CSV: plans.csv)
// - QuoteResult      : persisted quote batches per group run

// server/controllers/quoteController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const AffordabilityResult = require("../models/AfforadabilityResult");
const Pricing = require("../models/Pricing");
const Plan = require("../models/Plan");
const PlanCounty = require("../models/PlanCounties");
const ZipCounty = require("../models/ZipCounties");
const QuoteResult = require("../models/QuoteResult");

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
// Uses ZipCounties.zip_code_id (your schema) and tolerates string/number.
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
        meta: q.meta || null, // include metadata like county selection issues
        quotes: dedupedPlans,
      };
    }),
    createdAt: doc.createdAt,
  };
}



// --- On-market SLCSP (Benchmark) helper -------------------------------------
// Returns the 2nd-lowest premium silver plan for (countyId, age, tobacco).
// If only one priced silver plan exists, we fall back to the lowest (rank=1).
async function computeBenchmarkSilver({ countyId, age, tobacco }) {
  const county_id = String(countyId);

  // 1) All plans in county
  const planCountyRows = await PlanCounty.find({ county_id })
    .select({ plan_id: 1, _id: 0 })
    .lean();
  const planIds = Array.from(new Set(planCountyRows.map(r => r.plan_id)));
  if (!planIds.length) {
    return { error: `No plans in county_id ${county_id}` };
  }

  // 2) On-market Silver plans
  const silverPlans = await Plan.find({
    plan_id: { $in: planIds },
    on_market: true,
    level: /silver/i, // tolerate "Silver" / "silver"
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

  // 3) Pricing for this age+tobacco across those silver plans
  const silverIds = silverPlans.map(p => p.plan_id);
  const pricingRows = await Pricing.find({
    plan_id: { $in: silverIds },
    age,
    tobacco: !!tobacco,
  })
    .select({ plan_id: 1, premium: 1, _id: 0 })
    .lean();

  if (!pricingRows.length) {
    return { error: `No pricing for Silver plans at age ${age} (tobacco=${!!tobacco})` };
  }

  const premByPlan = new Map(pricingRows.map(p => [p.plan_id, Number(p.premium)]));

  // 4) Merge plan meta + premium, filter out missing premiums, rank ascending
  const ranked = silverPlans
    .map(p => ({
      plan_id: p.plan_id,
      premium: premByPlan.get(p.plan_id),
      carrier_name: p.carrier_name,
      display_name: p.display_name || p.name || null,
      plan_type: p.plan_type,
      level: p.level,
    }))
    .filter(x => Number.isFinite(x.premium))
    .sort((a, b) => a.premium - b.premium);

  if (!ranked.length) {
    return { error: `No priced Silver plans after filtering (age ${age}, tobacco=${!!tobacco})` };
  }

  // 5) Pick SLCSP: index 1 if available, else index 0 fallback
  const idx = ranked.length >= 2 ? 1 : 0;
  const chosen = ranked[idx];

  return {
    benchmark_plan_id: chosen.plan_id,
    benchmark_premium: chosen.premium,
    slcsp_rank: idx + 1, // 2 when we truly have 2+, else 1 fallback
    silver_candidates: ranked, // full ranked list for transparency/debug
  };
}

// -----------Generate Quotes----- controllers ----------------

// POST /api/groups/:groupId/quotes
// Generates a batch of off-market quotes for ALL members in the group.
// Handles multi-county ZIPs via: request override -> member.fips_code -> unique-from-zip -> else skip.
exports.generateQuotes = async (req, res) => {
  const { groupId } = req.params;
  const { effective_date, tobacco } = req.body || {}; // optional overrides for the run
  console.log(">>> Inside generateQuotes for group:", groupId);

  try {
    const group = await Group.findById(groupId).populate("classes");
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = await Member.find({ group: groupId });
    if (!members.length) return res.status(404).json({ error: "No members found in group" });

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

      // --- Latest affordability for the member (if present)
      const affordability = await AffordabilityResult.findOne({
        group: groupId,
        member: member._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      // For off-market: keep your prior behavior (adjusted_cost = premium - credit).
      // If you don't want PTC to affect off-market, set credit = 0.
      const credit = affordability?.premium_tax_credit
        ? Number(affordability.premium_tax_credit)
        : 0;

      const quotes = plans.map((pl) => {
        const premium = priceByPlan.get(pl.plan_id);
        return {
          plan_id: pl.plan_id,
          premium,
          adjusted_cost: Math.max(0, premium - credit),
          benchmark_plan_id: affordability?.benchmark_plan_id ?? null,
          benchmark_premium: affordability?.benchmark_premium ?? null,
          plan_details: pl,
        };
      });

      // Sort by premium ascending
      quotes.sort((a, b) => a.premium - b.premium);

      batchQuotes.push({
        member: member._id,
        affordability: affordability || null,
        meta: {
          zip_code: member.zip_code,
          county_id: countyId,
          county_source: countySource,
          age,
          tobacco: isTobacco,
        },
        quotes,
      });
    }

    const quoteDoc = new QuoteResult({
      group: groupId,
      quotes: batchQuotes,
      raw_context: { memberCount: members.length },
    });
    await quoteDoc.save();

    // Populate for a trimmed response
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
// Body: { member_id: "<ObjectId>", county_id: "<string>", effective_date?: "YYYY-MM-DD", tobacco?: boolean }
// Returns quotes for ONE member in ONE selected county. Does NOT save a QuoteResult.
exports.previewMemberQuotes = async (req, res) => {
  const { groupId } = req.params;
  const { member_id, county_id, effective_date, tobacco } = req.body || {};

  try {
    // Basic guards
    if (!member_id) {
      return res.status(400).json({ error: "member_id is required" });
    }
    if (!county_id) {
      return res.status(400).json({ error: "county_id is required (choose one from the list returned by /quotes)" });
    }

    // Group & Member
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = await Member.findById(member_id).lean();
    if (!member || String(member.group) !== String(groupId)) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    // Age & tobacco
    if (!member.date_of_birth) {
      return res.status(400).json({ error: "Member is missing date_of_birth" });
    }
    const age = calcAge(member.date_of_birth, effective_date);
    if (age == null) {
      return res.status(400).json({ error: "Could not compute member age" });
    }
    const isTobacco = (typeof tobacco === "boolean") ? tobacco : (member.tobacco ?? false);

    // Plans in selected county
    const planCountyRows = await PlanCounty.find({ county_id: String(county_id) })
      .select({ plan_id: 1, _id: 0 })
      .lean();
    const planIds = Array.from(new Set(planCountyRows.map(r => r.plan_id)));
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

    const priceByPlan = new Map(pricingRows.map(p => [p.plan_id, Number(p.premium)]));
    const pricedPlanIds = planIds.filter(pid => priceByPlan.has(pid));

    // Plan details
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

    // Optional affordability snapshot
    const affordability = await AffordabilityResult.findOne({
      group: groupId,
      member: member._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const credit = affordability?.premium_tax_credit
      ? Number(affordability.premium_tax_credit)
      : 0;

    const quotes = plans.map(pl => {
      const premium = priceByPlan.get(pl.plan_id);
      return {
        plan_id: pl.plan_id,
        premium,
        adjusted_cost: Math.max(0, premium - credit),
        benchmark_plan_id: affordability?.benchmark_plan_id ?? null,
        benchmark_premium: affordability?.benchmark_premium ?? null,
        plan_details: pl,
      };
    }).sort((a, b) => a.premium - b.premium);

    // Stateless response (not saved to QuoteResult)
    return res.json({
      member: {
        _id: member._id,
        first_name: member.first_name,
        last_name: member.last_name,
        date_of_birth: member.date_of_birth,
        zip_code: member.zip_code,
        tobacco: member.tobacco ?? false,
      },
      affordability: affordability ? {
        fpl_percent: affordability.fpl_percent,
        expected_contribution: affordability.expected_contribution,
        benchmark_plan_id: affordability.benchmark_plan_id,
        benchmark_premium: affordability.benchmark_premium,
        premium_tax_credit: affordability.premium_tax_credit,
        affordable: affordability.affordable,
      } : null,
      meta: {
        county_id: String(county_id),
        age,
        tobacco: isTobacco,
      },
      quotes
    });
  } catch (err) {
    console.error(">>> Error in previewMemberQuotes:", err);
    return res.status(500).json({ error: "Failed to preview quotes" });
  }
};


// POST /api/groups/:groupId/quotes/benchmark
// Body: { member_id, county_id, effective_date?, tobacco? }
// → Computes SLCSP (benchmark) for that member in that county (no DB writes).
exports.benchmarkForMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { member_id, county_id, effective_date, tobacco } = req.body || {};

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

    const bench = await computeBenchmarkSilver({
      countyId: county_id,
      age,
      tobacco: isTobacco,
    });

    if (bench.error) {
      return res.status(400).json({ error: bench.error });
    }

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
        premium: bench.benchmark_premium,
        slcsp_rank: bench.slcsp_rank,
      },
      silver_candidates: bench.silver_candidates, // optional: remove if you want a smaller payload
    });
  } catch (err) {
    console.error(">>> Error benchmarkForMember:", err);
    return res.status(500).json({ error: "Failed to compute benchmark" });
  }
};