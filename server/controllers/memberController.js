// server/controllers/memberController.js
const Member = require("../models/Member");
const Group = require("../models/Group");
const ideon = require("../services/ideon");
const { v4: uuidv4 } = require("uuid");

// POST /api/groups/:groupId/members
exports.createMember = async (req, res) => {
  const { groupId } = req.params;
  const payload = req.body;
  console.log(">>> Inside createMember, groupId:", groupId, "payload:", payload);

  let ideonMemberId;
  let ideonData = null;

  try {
    // Step 1: Find the group in Mongo
    const group = await Group.findById(groupId);
    if (!group) {
      console.warn(">>> Group not found in Mongo:", groupId);
      return res.status(404).json({ error: "Group not found" });
    }
    console.log(">>> Found group in Mongo with ideon_group_id:", group.ideon_group_id);

    // Step 2: Try Ideon API
    try {
      console.log(">>> Calling Ideon API addMember...");
      const ideonRes = await ideon.addMember(group.ideon_group_id, {
        first_name: payload.first_name,
        last_name: payload.last_name,
        dob: payload.dob, // must be YYYY-MM-DD
        gender: payload.gender || "U",
        zip_code: payload.zip_code,
        external_id: payload.external_id || `ext-${Date.now()}`
      });

      ideonMemberId = ideonRes.data.member.id;
      ideonData = ideonRes.data;
      console.log(">>> Ideon member created:", ideonMemberId);
    } catch (err) {
      console.warn(">>> Ideon addMember failed, falling back");
      console.warn("    Status:", err.response?.status);
      console.warn("    Data:", err.response?.data);
      console.warn("    Message:", err.message);
      ideonMemberId = `mock-${uuidv4()}`;
    }

    // Step 3: Always save to Mongo
    console.log(">>> Saving member to Mongo...");
    const memberDoc = new Member({
        group: groupId,
        first_name: payload.first_name,
        last_name: payload.last_name,
        date_of_birth: payload.dob ? new Date(payload.dob) : null, // map dob → date_of_birth
        gender: payload.gender || "U",
        zip_code: payload.zip_code,
        ichra_class: payload.class || null, // renamed to match schema, optional
        ideon_member_id: ideonMemberId,
        dependents: payload.dependents || []
      });

    await memberDoc.save();
    console.log(">>> Member saved in MongoDB:", memberDoc._id);

    return res.status(201).json({
      message: "Member created successfully",
      member: memberDoc,
      ideon: ideonData // will be null if fallback
    });
  } catch (err) {
    console.error(">>> Error creating member (outer catch):", err);
    return res.status(500).json({ error: "Failed to create member" });
  }
};

// GET /api/groups/:groupId/members
exports.getMembersByGroup = async (req, res) => {
  try {
    console.log(">>> Fetching members for group:", req.params.groupId);
    const members = await Member.find({ group: req.params.groupId }).populate("class");
    console.log(">>> Found members count:", members.length);
    res.json(members);
  } catch (err) {
    console.error(">>> Error fetching members:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
};
