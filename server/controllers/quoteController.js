// server/controllers/quoteController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const AffordabilityResult = require("../models/AfforadabilityResult");
const Pricing = require("../models/Pricing");
const Plan = require("../models/Plan");
const PlanCounty = require("../models/PlanCounties");
const ZipCounty = require("../models/ZipCounties");
const QuoteResult = require("../models/QuoteResult");

// --- helper: trim & dedupe ---
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
      // Deduplicate + filter out empties
      const dedupedPlans = Array.from(
        new Map(
          q.quotes
            .filter(
              (plan) =>
                plan.plan_details &&
                plan.plan_details.carrier_name &&
                plan.plan_details.display_name
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
                  display_name: plan.plan_details.display_name,
                  plan_type: plan.plan_details.plan_type,
                  level: plan.plan_details.level,
                },
              },
            ])
        ).values()
      );

      return {
        member: q.member?._id
          ? {
              _id: q.member._id,
              first_name: q.member.first_name,
              last_name: q.member.last_name,
              dob: q.member.dob,
              zip_code: q.member.zip_code,
              tobacco: q.member.tobacco,
            }
          : q.member,
        affordability: q.affordability
          ? {
              fpl_percent: q.affordability.fpl_percent,
              expected_contribution: q.affordability.expected_contribution,
              benchmark_plan_id: q.affordability.benchmark_plan_id,
              benchmark_premium: q.affordability.benchmark_premium,
              premium_tax_credit: q.affordability.premium_tax_credit,
              affordable: q.affordability.affordable,
            }
          : null,
        quotes: dedupedPlans,
      };
    }),
    createdAt: doc.createdAt,
  };
}

// --- Generate quotes ---
exports.generateQuotes = async (req, res) => {
  const { groupId } = req.params;
  console.log(">>> Inside generateQuotes for group:", groupId);

  try {
    const group = await Group.findById(groupId).populate("classes");
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = await Member.find({ group: groupId });
    if (!members.length) return res.status(404).json({ error: "No members found in group" });

    const quotes = [];
    for (const member of members) {
      const affordability = await AffordabilityResult.findOne({ group: groupId, member: member._id }).sort({ createdAt: -1 });
      if (!affordability) continue;

      const zipCounty = await ZipCounty.findOne({ zip_code_id: member.zip_code });
      if (!zipCounty) continue;

      const planCounties = await PlanCounty.find({ county_id: zipCounty.county_id });
      const planIds = planCounties.map((pc) => pc.plan_id);
      if (!planIds.length) continue;

      const plans = await Plan.find({ plan_id: { $in: planIds } });
      if (!plans.length) continue;

      const age = calculateAge(member.date_of_birth);
      if (age == null) continue;

      const tobacco = member.tobacco ?? false;
      const pricing = await Pricing.find({ plan_id: { $in: planIds }, age, tobacco });
      if (!pricing.length) continue;

      const planMap = new Map();
      for (const price of pricing) {
        if (!planMap.has(price.plan_id)) {
          const plan = plans.find((p) => p.plan_id === price.plan_id);
          const credit = affordability.premium_tax_credit || 0;
          planMap.set(price.plan_id, {
            plan_id: price.plan_id,
            premium: price.rate,
            benchmark_plan_id: affordability.benchmark_plan_id,
            benchmark_premium: affordability.benchmark_premium,
            adjusted_cost: Math.max(0, price.rate - credit),
            plan_details: plan || {},
          });
        }
      }

      quotes.push({
        member: member._id,
        affordability: affordability.toObject(),
        quotes: Array.from(planMap.values()),
      });
    }

    const quoteDoc = new QuoteResult({
      group: groupId,
      quotes,
      raw_context: { memberCount: members.length },
    });
    await quoteDoc.save();

    return res.json({ message: "Quotes generated", result: transformQuoteDoc(quoteDoc) });
  } catch (err) {
    console.error(">>> Error generating quotes:", err);
    return res.status(500).json({ error: "Failed to generate quotes" });
  }
};

// --- Latest ---
exports.getLatestQuotes = async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await QuoteResult.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate("quotes.member", "first_name last_name dob zip_code tobacco");

    if (!result) return res.status(404).json({ error: "No quotes found" });
    return res.json(transformQuoteDoc(result));
  } catch (err) {
    console.error(">>> Error fetching latest quotes:", err);
    return res.status(500).json({ error: "Failed to fetch quotes" });
  }
};

// --- History ---
exports.getQuoteHistory = async (req, res) => {
  const { groupId } = req.params;
  try {
    const results = await QuoteResult.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate("quotes.member", "first_name last_name dob zip_code tobacco");

    return res.json(results.map(transformQuoteDoc));
  } catch (err) {
    console.error(">>> Error fetching quote history:", err);
    return res.status(500).json({ error: "Failed to fetch quote history" });
  }
};

// --- Helper: safe age calc ---
function calculateAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}
