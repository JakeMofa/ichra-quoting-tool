// server/controllers/memberController.js
const Member = require("../models/Member");
const Group = require("../models/Group");
const ICHRAClass = require("../models/ICHRAClass");
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
      const locationId =
        group.locations && group.locations.length > 0
          ? group.locations[0].ideon_location_id
          : "default-loc-id";

      const ideonPayload = {
        members: [
          {
            first_name: payload.first_name,
            last_name: payload.last_name,
            date_of_birth: payload.dob || "1990-01-01",
            gender: payload.gender || "U",
            zip_code: payload.zip_code,
            fips_code: payload.fips_code || "36081",
            location_id: locationId,
            cobra: false,
            retiree: false,
            last_used_tobacco: null,
            dependents: payload.dependents || [],
            external_id: payload.external_id || `ext-${Date.now()}`
          }
        ]
      };

      const ideonRes = await ideon.addMember(group.ideon_group_id, ideonPayload);

      if (ideonRes.data.members && ideonRes.data.members.length > 0) {
        ideonMemberId = ideonRes.data.members[0].id;
        ideonData = ideonRes.data.members[0];
        console.log(">>> Ideon member created:", ideonMemberId);
      } else {
        console.warn(">>> Unexpected Ideon response:", ideonRes.data);
        ideonMemberId = `mock-${uuidv4()}`;
      }
    } catch (err) {
      console.warn(">>> Ideon addMember failed, falling back");
      console.warn("    Status:", err.response?.status);
      console.warn("    Data:", err.response?.data);
      console.warn("    Message:", err.message);
      ideonMemberId = `mock-${uuidv4()}`;
    }

    // Step 3: Save to Mongo
    console.log(">>> Saving member to Mongo...");
    const memberDoc = new Member({
      group: groupId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      date_of_birth: payload.dob ? new Date(payload.dob) : new Date("1990-01-01"),
      gender: payload.gender || "U",
      zip_code: payload.zip_code,
      ichra_class: payload.ichra_class || null,   // renamed field for clarity
      ideon_member_id: ideonMemberId,
      dependents: payload.dependents || []
    });

    await memberDoc.save();
    console.log(">>> Member saved in MongoDB:", memberDoc._id);

    // Step 4: If class provided, link the member to the class
    if (payload.ichra_class) {
      try {
        const ichraClass = await ICHRAClass.findById(payload.ichra_class);
        if (ichraClass) {
          ichraClass.members.push(memberDoc._id);
          await ichraClass.save();
          console.log(">>> Linked member to class:", ichraClass._id);
        } else {
          console.warn(">>> Provided ichra_class not found:", payload.ichra_class);
        }
      } catch (err) {
        console.error(">>> Error linking member to class:", err.message);
      }
    }

    return res.status(201).json({
      message: "Member created successfully",
      member: {
        _id: memberDoc._id,
        first_name: memberDoc.first_name,
        last_name: memberDoc.last_name,
        dob: memberDoc.date_of_birth,
        gender: memberDoc.gender,
        zip_code: memberDoc.zip_code,
        ichra_class: memberDoc.ichra_class,
        ideon_member_id: memberDoc.ideon_member_id,
        dependents: memberDoc.dependents,
        createdAt: memberDoc.createdAt,
        updatedAt: memberDoc.updatedAt
      },
      ideon: ideonData
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
    const members = await Member.find({ group: req.params.groupId }).populate("ichra_class");
    console.log(">>> Found members count:", members.length);

    res.json(
      members.map(m => ({
        _id: m._id,
        first_name: m.first_name,
        last_name: m.last_name,
        dob: m.date_of_birth,
        gender: m.gender,
        zip_code: m.zip_code,
        ichra_class: m.ichra_class,
        ideon_member_id: m.ideon_member_id,
        dependents: m.dependents,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }))
    );
  } catch (err) {
    console.error(">>> Error fetching members:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
};
