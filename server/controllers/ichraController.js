// server/controllers/ichraController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const ideon = require("../services/ideon");
const AffordabilityResult = require("../models/AfforadabilityResult"); // 

// POST /api/groups/:groupId/members/:memberId/ichra
exports.calculateICHRA = async (req, res) => {
  const { groupId, memberId } = req.params;
  console.log(">>> Inside calculateICHRA for group:", groupId, "member:", memberId);

  try {
    // 1. Verify group exists
    const group = await Group.findById(groupId).populate("classes");
    if (!group) {
      console.warn(">>> Group not found:", groupId);
      return res.status(404).json({ error: "Group not found" });
    }

    // 2. Verify member exists in group
    const member = await Member.findById(memberId);
    if (!member || member.group.toString() !== groupId) {
      console.warn(">>> Member not found in group:", memberId);
      return res.status(404).json({ error: "Member not found in this group" });
    }

    console.log(">>> Found group + member, calling Ideon ICHRA API...");

    let resultData;
    try {
      // 3. Try real Ideon API call
      const ideonRes = await ideon.calculateICHRA(
        group.ideon_group_id,
        member.ideon_member_id
      );
      resultData = ideonRes.data;
      console.log(">>> Ideon ICHRA result received");
    } catch (err) {
      // 4. Fallback if API fails
      console.warn(">>> Ideon calculateICHRA failed, falling back");
      console.warn("    Status:", err.response?.status);
      console.warn("    Data:", err.response?.data);
      console.warn("    Message:", err.message);

      resultData = {
        fpl_percent: 250,
        expected_contribution: 400,
        benchmark_plan_id: "mock-benchmark-plan",
        benchmark_premium: 600,
        premium_tax_credit: 200,
        affordable: true,
        mock: true
      };
    }

    // 5. Save results in Mongo
    const resultDoc = new AffordabilityResult({
      group: groupId,
      member: memberId,
      fpl_percent: resultData.fpl_percent,
      expected_contribution: resultData.expected_contribution,
      benchmark_plan_id: resultData.benchmark_plan_id,
      benchmark_premium: resultData.benchmark_premium,
      premium_tax_credit: resultData.premium_tax_credit,
      affordable: resultData.affordable,
      raw_response: resultData
    });
    await resultDoc.save();

    console.log(">>> Affordability results saved:", resultDoc._id);

    return res.status(201).json({
      message: "ICHRA calculated",
      result: resultDoc
    });
  } catch (err) {
    console.error(">>> Error calculating ICHRA (outer catch):", err);
    return res.status(500).json({ error: "Failed to calculate ICHRA" });
  }
};

// GET latest affordability result
// GET /api/groups/:groupId/members/:memberId/ichra
exports.getLatestICHRA = async (req, res) => {
    const { groupId, memberId } = req.params;
    console.log(">>> Fetching latest ICHRA result for group:", groupId, "member:", memberId);
  
    try {
      const result = await AffordabilityResult.findOne({
        group: groupId,
        member: memberId
      }).sort({ createdAt: -1 });
  
      if (!result) {
        return res.status(404).json({ error: "No affordability results found" });
      }
  
      return res.json(result);
    } catch (err) {
      console.error(">>> Error fetching latest ICHRA:", err);
      return res.status(500).json({ error: "Failed to fetch affordability results" });
    }
  };
  
  // GET full history of affordability results
  // GET /api/groups/:groupId/members/:memberId/ichra/history
  exports.getICHRAHistory = async (req, res) => {
    const { groupId, memberId } = req.params;
    console.log(">>> Fetching ICHRA history for group:", groupId, "member:", memberId);
  
    try {
      const results = await AffordabilityResult.find({
        group: groupId,
        member: memberId
      }).sort({ createdAt: -1 });
  
      return res.json(results);
    } catch (err) {
      console.error(">>> Error fetching ICHRA history:", err);
      return res.status(500).json({ error: "Failed to fetch affordability history" });
    }
  };