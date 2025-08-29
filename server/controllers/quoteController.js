// server/controllers/quoteController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const AffordabilityResult = require("../models/AfforadabilityResult"); // keep filename
const Pricing = require("../models/Pricing");
const Plan = require("../models/Plan");
const PlanCounty = require("../models/PlanCounties");
const ZipCounty = require("../models/ZipCounties");
const QuoteResult = require("../models/QuoteResult");

// POST /api/groups/:groupId/quotes
exports.generateQuotes = async (req, res) => {
  const { groupId } = req.params;
  console.log(">>> Inside generateQuotes for group:", groupId);

  try {
    // 1. Load group
    const group = await Group.findById(groupId).populate("classes");
    if (!group) {
      console.warn(">>> Group not found:", groupId);
      return res.status(404).json({ error: "Group not found" });
    }

    // 2. Load members in group
    const members = await Member.find({ group: groupId });
    if (!members.length) {
      console.warn(">>> No members found for group:", groupId);
      return res.status(404).json({ error: "No members found in group" });
    }

    const quotes = [];

    // 3. Loop over members
    for (const member of members) {
      console.log(">>> Generating quotes for member:", member._id);

      // 3a. Get latest affordability result
      const affordability = await AffordabilityResult.findOne({
        group: groupId,
        member: member._id,
      }).sort({ createdAt: -1 });

      if (!affordability) {
        console.warn(">>> Skipping member, no affordability result:", member._id);
        continue;
      }

      // 3b. Resolve member's county from ZIP
      const zipCounty = await ZipCounty.findOne({ zip_code: member.zip_code });
      if (!zipCounty) {
        console.warn(">>> Skipping member, no county for zip:", member.zip_code);
        continue;
      }

      // 3c. Find plans in that county
      const planCounties = await PlanCounty.find({ county_id: zipCounty.county_id });
      const planIds = planCounties.map(pc => pc.plan_id);

      if (!planIds.length) {
        console.warn(">>> Skipping member, no plans for county:", zipCounty.county_id);
        continue;
      }

      const plans = await Plan.find({ plan_id: { $in: planIds } });
      if (!plans.length) {
        console.warn(">>> Skipping member, no plan details found for IDs:", planIds);
        continue;
      }

      // 3d. Find pricing for this member’s age + tobacco status
      const age = calculateAge(member.date_of_birth);
      if (age == null) {
        console.warn(">>> Skipping member, invalid DOB:", member.date_of_birth);
        continue;
      }

      const tobacco = member.tobacco ?? false;

      const pricing = await Pricing.find({
        plan_id: { $in: planIds },
        age,
        tobacco,
      });

      if (!pricing.length) {
        console.warn(
          ">>> Skipping member, no pricing found (age:",
          age,
          "tobacco:",
          tobacco,
          ")"
        );
        continue;
      }

      // 3e. Merge plans + pricing
      const planQuotes = pricing.map(price => {
        const plan = plans.find(p => p.plan_id === price.plan_id);
        return {
          plan_id: price.plan_id,
          premium: price.rate,
          benchmark_plan_id: affordability.benchmark_plan_id,
          benchmark_premium: affordability.benchmark_premium,
          adjusted_cost: Math.max(
            0,
            price.rate - (affordability.premium_tax_credit || 0)
          ),
          plan_details: plan || {},
        };
      });

      // Save just member._id (schema expects ObjectId)
      quotes.push({
        member: member._id,
        affordability: affordability.toObject(),
        quotes: planQuotes,
      });
    }

    // 4. Save quote batch to Mongo
    const quoteDoc = new QuoteResult({
      group: groupId,
      quotes,
      raw_context: { memberCount: members.length },
    });
    await quoteDoc.save();

    console.log(">>> Quotes saved:", quoteDoc._id);

    return res.json({
      message: "Quotes generated",
      result: quoteDoc,
    });
  } catch (err) {
    console.error(">>> Error generating quotes:", err);
    return res.status(500).json({ error: "Failed to generate quotes" });
  }
};

// GET latest quotes
exports.getLatestQuotes = async (req, res) => {
  const { groupId } = req.params;
  console.log(">>> Fetching latest quotes for group:", groupId);

  try {
    const result = await QuoteResult.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate("quotes.member", "first_name last_name dob zip_code tobacco");

    if (!result) {
      return res.status(404).json({ error: "No quotes found" });
    }

    return res.json(result);
  } catch (err) {
    console.error(">>> Error fetching latest quotes:", err);
    return res.status(500).json({ error: "Failed to fetch quotes" });
  }
};

// GET full quote history
exports.getQuoteHistory = async (req, res) => {
  const { groupId } = req.params;
  console.log(">>> Fetching quote history for group:", groupId);

  try {
    const results = await QuoteResult.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("group", "company_name contact_name contact_email")
      .populate("quotes.member", "first_name last_name dob zip_code tobacco");

    return res.json(results);
  } catch (err) {
    console.error(">>> Error fetching quote history:", err);
    return res.status(500).json({ error: "Failed to fetch quote history" });
  }
};

// helper: calculate age safely
function calculateAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;

  const diff = Date.now() - d.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}
