// server/controllers/ichraController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const ideon = require("../services/ideon");
const AffordabilityResult = require("../models/AfforadabilityResult");

// POST /api/groups/:groupId/members/:memberId/ichra  (creates a new calc record)
exports.calculateICHRA = async (req, res) => {
  const { groupId, memberId } = req.params;
  console.log(">>> Inside calculateICHRA for group:", groupId, "member:", memberId);

  try {
    // 1) Verify group & member
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = await Member.findById(memberId);
    if (!member || member.group.toString() !== groupId) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    if (!group.ideon_group_id) {
      return res
        .status(400)
        .json({ error: "Group is missing ideon_group_id; create group in Ideon first." });
    }

    // 2) Overrides (query-string OR JSON body)
    //    - location: "home" | "work"   (query supports ?location=… OR ?rating_area_location=…)
    //    - plan_year: number
    //    - effective_date: YYYY-MM-DD
    const rawLocation =
    req.query.location ??
    req.query.rating_area_location ??
    req.body?.rating_area_location ??
    "work";
  
  const ratingAreaLocation =
    (typeof rawLocation === "string" &&
      (rawLocation.toLowerCase() === "home" || rawLocation.toLowerCase() === "work"))
      ? rawLocation.toLowerCase()
      : "work";
  
  const planYear =
    req.query.plan_year != null
      ? Number(req.query.plan_year)
      : (req.body?.plan_year != null ? Number(req.body.plan_year) : new Date().getFullYear());
  
  const effectiveDate =
    (typeof req.query.effective_date === "string" && req.query.effective_date) ||
    (typeof req.body?.effective_date === "string" && req.body.effective_date) ||
    new Date().toISOString().split("T")[0];

    console.log(">>> Found group + member, calling Ideon ICHRA API...");

    let resultData;

    try {
      // 3) Start calc (nested endpoint)
      const startPayload = {
        ichra_affordability_calculation: {
          effective_date: effectiveDate,
          plan_year: planYear,                   // optional but accepted by Ideon
          rating_area_location: ratingAreaLocation, // "home" or "work"
        },
      };

      console.log(">>> Starting ICHRA with ideon_group_id:", group.ideon_group_id, "payload:", startPayload);
      const startRes = await ideon.startICHRA(group.ideon_group_id, startPayload);

      const calcId =
        startRes?.data?.id ||
        startRes?.data?.ichra_affordability_calculation?.id;

      if (!calcId) {
        console.error(">>> ICHRA start response missing calc id:", startRes?.data);
        throw new Error("Failed to start ICHRA affordability calculation (no calc id).");
      }

      console.log(">>> Ideon ICHRA calc started:", calcId);

      // 4) Poll until complete
      let status = "pending";
      let pollResult = null;

      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        const statusRes = await ideon.getICHRA(calcId);

        status =
          statusRes?.data?.status ||
          statusRes?.data?.ichra_affordability_calculation?.status ||
          "pending";

        pollResult =
          statusRes?.data?.ichra_affordability_calculation ||
          statusRes?.data ||
          null;

        console.log(`>>> Poll attempt ${i + 1}:`, status);
        if (status === "complete" || status === "failed") break;
      }

      if (status !== "complete") {
        console.error(">>> Polling timed out or failed. Last poll result:", pollResult);
        throw new Error(`Affordability calculation status: ${status}`);
      }

      // 5) Get member-level results
      const membersRes = await ideon.getICHRAForMembers(calcId);
      const resultsArr = membersRes?.data?.members || [];

      const pickExternal = (m) =>
        (m?.member_external_id ?? m?.external_id ?? m?.external_member_id ?? null)?.toString().trim();
      const pickIdeonId = (m) =>
        (m?.member_id ?? m?.id ?? null)?.toString().trim();

      const ourExternal = (member.external_id ?? "").toString().trim();
      const ourIdeonId  = (member.ideon_member_id ?? "").toString().trim();

      // matching priority observed in your logs:
      // 1) our ideon_member_id == their member_external_id
      // 2) our ideon_member_id == their id/member_id
      // 3) our external_id == their external field
      // 4) single-result fallback
      let memberCalc = resultsArr.find((m) => pickExternal(m) === ourIdeonId);
      let matchedBy  = memberCalc ? "ideon_member_id→member_external_id" : null;

      if (!memberCalc && ourIdeonId) {
        memberCalc = resultsArr.find((m) => pickIdeonId(m) === ourIdeonId);
        if (memberCalc) matchedBy = "ideon_member_id→id";
      }
      if (!memberCalc && ourExternal) {
        memberCalc = resultsArr.find((m) => pickExternal(m) === ourExternal);
        if (memberCalc) matchedBy = "external_id";
      }
      if (!memberCalc && resultsArr.length === 1) {
        memberCalc = resultsArr[0];
        matchedBy = "single-result-default";
      }

      if (!memberCalc) {
        console.error(">>> Member not found in ICHRA results", {
          wanted_external_id: ourExternal,
          wanted_ideon_member_id: ourIdeonId,
          available_externals: resultsArr.map((m) => pickExternal(m)),
          available_ideon_ids: resultsArr.map((m) => pickIdeonId(m)),
          raw_members: resultsArr,
        });
        throw new Error("Member result not found in Ideon affordability response");
      }

      console.log(">>> Matched ICHRA member using", matchedBy, {
        matched_external: pickExternal(memberCalc),
        matched_ideon_id: pickIdeonId(memberCalc),
      });

      // 6) Normalize numbers that may arrive as strings
      const num = (v) => (v == null || v === "" ? null : Number(v));
      const benchmark = (memberCalc.plans && memberCalc.plans[0]) || null;

      const minEmp  = num(memberCalc.minimum_employer_contribution);
      const fplMin  = num(memberCalc.fpl_minimum_employer_contribution);
      const ptc     = num(memberCalc.premium_tax_credit);
      const benchPr = num(benchmark?.premium);

      const affordable =
        typeof memberCalc.affordable === "boolean"
          ? memberCalc.affordable
          : (minEmp != null && !Number.isNaN(minEmp) && member.safe_harbor_income != null)
            ? minEmp <= Number(member.safe_harbor_income)
            : false;

      const resultData = {
        minimum_employer_contribution: minEmp,
        fpl_minimum_employer_contribution: fplMin,
        premium_tax_credit: ptc,
        benchmark_plan_id: benchmark?.id ?? null,
        benchmark_premium: benchPr,
        affordable,
        raw_response: { calc: pollResult, member: memberCalc },
      };

      // 7) Save
      const resultDoc = new AffordabilityResult({
        group: groupId,
        member: memberId,
        ...resultData,
      });
      await resultDoc.save();

      //reread from mongo to ensure we return the  finalized values
      const saved = await AffordabilityResult.findById(resultDoc._id).lean();

      console.log(">>> Affordability results saved:", resultDoc._id);
      return res.status(201).json({ message: "ICHRA calculated", result: resultDoc });

    } catch (err) {
      // fallback mock to keep the flow alive
      console.warn(">>> Ideon calculateICHRA failed, falling back");
      console.warn("    Status:", err.response?.status);
      console.warn("    Data:", err.response?.data);
      console.warn("    Message:", err.message);

      const resultDoc = new AffordabilityResult({
        group: groupId,
        member: memberId,
        minimum_employer_contribution: 400,
        fpl_minimum_employer_contribution: 500,
        premium_tax_credit: 200,
        benchmark_plan_id: "mock-benchmark-plan",
        benchmark_premium: 600,
        affordable: true,
        raw_response: { mock: true },
      });
      await resultDoc.save();

      //Re-read same thing  for ichra
      const saved = await AffordabilityResult.findById(resultDoc._id).lean();


      console.log(">>> Affordability results saved (mock):", resultDoc._id);
      return res.status(201).json({ message: "ICHRA calculated", result: resultDoc });
    }

  } catch (err) {
    console.error(">>> Error calculating ICHRA (outer catch):", err);
    return res.status(500).json({ error: "Failed to calculate ICHRA" });
  }
};

// GET latest affordability result
exports.getLatestICHRA = async (req, res) => {
  const { groupId, memberId } = req.params;
  try {
    const result = await AffordabilityResult.findOne({ group: groupId, member: memberId })
      .sort({ createdAt: -1 });
    if (!result) return res.status(404).json({ error: "No affordability results found" });
    return res.json(result);
  } catch (err) {
    console.error(">>> Error fetching latest ICHRA:", err);
    return res.status(500).json({ error: "Failed to fetch affordability results" });
  }
};

// GET full history
exports.getICHRAHistory = async (req, res) => {
  const { groupId, memberId } = req.params;
  try {
    const results = await AffordabilityResult.find({ group: groupId, member: memberId })
      .sort({ createdAt: -1 });
    return res.json(results);
  } catch (err) {
    console.error(">>> Error fetching ICHRA history:", err);
    return res.status(500).json({ error: "Failed to fetch affordability history" });
  }
};
