// server/controllers/memberController.js
const mongoose = require("mongoose");                 // needed for ObjectId validation
const Member = require("../models/Member");
const Group = require("../models/Group");
const ICHRAClass = require("../models/ICHRAClass");
const ideon = require("../services/ideon");
const { v4: uuidv4 } = require("uuid");

// --- helpers ---
function genExternalId() {
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function parseDOB(payload) {
  const d = payload.dob || payload.date_of_birth;
  return d ? new Date(d) : new Date("1990-01-01");
}

// POST /api/groups/:groupId/members
exports.createMember = async (req, res) => {
  const { groupId } = req.params;
  const payload = req.body;
  console.log(">>> Inside createMember, groupId:", groupId, "payload:", payload);

  let ideonMemberId = null;
  let ideonData = null;

  try {
    // 1) Validate group
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // 2) Choose a work location for the member (first group location by default)
    const groupLoc = (group.locations && group.locations[0]) || {};
    // Allow overrides from payload if the UI sends them explicitly
    const locationId =
      payload.location_id ||
      groupLoc.ideon_location_id ||
      groupLoc.location_id ||
      null;

    const fipsCode =
      payload.fips_code ||
      groupLoc.fips_code ||
      null;

    // 3) external_id is REQUIRED ( indexed it per group)
    const externalId = payload.external_id || genExternalId();

    // 4) Tries Ideon addMember if we have an Ideon group id and the required fields
    try {
      if (!group.ideon_group_id) throw new Error("Missing ideon_group_id on group");

      const ideonPayload = {
        members: [
          {
            first_name: payload.first_name,
            last_name: payload.last_name,
            date_of_birth: payload.dob || payload.date_of_birth || "1990-01-01",
            gender: payload.gender || "U",

            // location
            zip_code: payload.zip_code,
            fips_code: fipsCode,            // required by Ideon
            location_id: locationId,        // required by Ideon

            // flags
            cobra: false,
            retiree: false,
            last_used_tobacco: null,

            // dependents + affordability inputs
            dependents: payload.dependents || [],
            household_income: payload.household_income,
            safe_harbor_income: payload.safe_harbor_income,
            household_size: payload.household_size,

            // key used to match ICHRA results later
            external_id: externalId,
          },
        ],
      };

      console.log(">>> Calling Ideon API addMember...");
      const ideonRes = await ideon.addMember(group.ideon_group_id, ideonPayload);

      if (ideonRes?.data?.members?.length) {
        ideonMemberId = ideonRes.data.members[0].id || null;
        ideonData = ideonRes.data.members[0];
        console.log(">>> Ideon member created:", ideonMemberId);
      } else {
        ideonMemberId = `mock-${uuidv4()}`;
        console.warn(">>> Ideon addMember returned no members array, using mock id");
      }
    } catch (err) {
      console.warn(">>> Ideon addMember failed, falling back:", err.response?.data || err.message);
      ideonMemberId = `mock-${uuidv4()}`;
    }

    // 5) Save to Mongo —  persist external_id, fips_code, location_id
    const memberDoc = new Member({
      group: groupId,
      ichra_class: payload.ichra_class || null,

      first_name: payload.first_name,
      last_name: payload.last_name,
      date_of_birth: parseDOB(payload),
      gender: payload.gender || "U",

      zip_code: payload.zip_code,
      fips_code: fipsCode,
      location_id: locationId,

      dependents: payload.dependents || [],
      household_income: payload.household_income,
      safe_harbor_income: payload.safe_harbor_income,
      household_size: payload.household_size,

      ideon_member_id: ideonMemberId,
      external_id: externalId,
    });

    await memberDoc.save();
    console.log(">>> Member saved in MongoDB:", memberDoc._id);

    // 6) Link to class if provided
    if (payload.ichra_class) {
      const ichraClass = await ICHRAClass.findById(payload.ichra_class);
      if (ichraClass) {
        ichraClass.members.push(memberDoc._id);
        await ichraClass.save();
        console.log(">>> Linked member to class:", ichraClass._id);
      }
    }

    // 7) Response — include external_id, fips_code, location_id
    return res.status(201).json({
      message: "Member created successfully",
      member: {
        _id: memberDoc._id,
        first_name: memberDoc.first_name,
        last_name: memberDoc.last_name,
        dob: memberDoc.date_of_birth,
        gender: memberDoc.gender,

        zip_code: memberDoc.zip_code,
        fips_code: memberDoc.fips_code,
        location_id: memberDoc.location_id,

        ichra_class: memberDoc.ichra_class,
        household_income: memberDoc.household_income,
        safe_harbor_income: memberDoc.safe_harbor_income,
        household_size: memberDoc.household_size,

        external_id: memberDoc.external_id,
        ideon_member_id: memberDoc.ideon_member_id,
        dependents: memberDoc.dependents,

        createdAt: memberDoc.createdAt,
        updatedAt: memberDoc.updatedAt,
      },
      ideon: ideonData,
    });
  } catch (err) {
    console.error(">>> Error creating member (outer catch):", err);
    // If  enabled a unique index on (group, external_id), you may see Mongo 11000 dup key errors here.
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Duplicate external_id for this group" });
    }
    return res.status(500).json({ error: "Failed to create member" });
  }
};

// GET /api/groups/:groupId/members
exports.getMembersByGroup = async (req, res) => {
  try {
    const members = await Member.find({ group: req.params.groupId }).populate("ichra_class");
    res.json(
      members.map((m) => ({
        _id: m._id,
        first_name: m.first_name,
        last_name: m.last_name,
        dob: m.date_of_birth,
        gender: m.gender,

        zip_code: m.zip_code,
        fips_code: m.fips_code,
        location_id: m.location_id,

        ichra_class: m.ichra_class,
        household_income: m.household_income,
        safe_harbor_income: m.safe_harbor_income,
        household_size: m.household_size,

        external_id: m.external_id,
        ideon_member_id: m.ideon_member_id,
        dependents: m.dependents,

        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))
    );
  } catch (err) {
    console.error(">>> Error fetching members:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
};

// PATCH /api/groups/:groupId/members/:memberId
exports.updateMember = async (req, res) => {
  const { groupId, memberId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Invalid groupId or memberId" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = await Member.findById(memberId);
    if (!member || member.group?.toString() !== groupId) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    const {
      ichra_class,                   // ObjectId of ICHRAClass
      old_employer_contribution,     // Number
      old_employee_contribution,     // Number

      // optional
      household_income,
      safe_harbor_income,
      household_size,
      zip_code,
      fips_code,
      location_id,
      gender,
      date_of_birth,
    } = req.body || {};

    // (1) Reassign class if provided (and belongs to this group)
    if (ichra_class) {
      if (!mongoose.Types.ObjectId.isValid(ichra_class)) {
        return res.status(400).json({ error: "Invalid ichra_class id" });
      }
      const klass = await ICHRAClass.findById(ichra_class);
      if (!klass || klass.group.toString() !== groupId) {
        return res.status(400).json({ error: "ichra_class does not belong to this group" });
      }
      member.ichra_class = ichra_class;
    }

    // (2) Prior plan contributions
    if (old_employer_contribution != null) {
      member.old_employer_contribution = Number(old_employer_contribution);
    }
    if (old_employee_contribution != null) {
      member.old_employee_contribution = Number(old_employee_contribution);
    }

    // (3) Optional income / household updates
    if (household_income != null) member.household_income = Number(household_income);
    if (safe_harbor_income != null) member.safe_harbor_income = Number(safe_harbor_income);
    if (household_size != null) member.household_size = Number(household_size);

    // (4) Location & demographic updates
    if (zip_code != null) {
      // accept number or string; store as 5-digit string
      const z = String(zip_code).trim();
      const z5 = z.padStart(5, "0").slice(0, 5);
      if (!/^\d{5}$/.test(z5)) {
        return res.status(400).json({ error: "zip_code must be 5 digits" });
      }
      member.zip_code = z5;
    }
    if (fips_code != null) member.fips_code = String(fips_code).trim();
    if (location_id != null) member.location_id = String(location_id).trim();
    if (gender != null) member.gender = String(gender).trim();
    if (date_of_birth != null) {
      const d = new Date(date_of_birth);
      if (isNaN(d)) return res.status(400).json({ error: "Invalid date_of_birth" });
      member.date_of_birth = d;
    }

    await member.save();
    return res.json({ message: "Member updated successfully", member });
  } catch (err) {
    console.error(">>> Error updating member:", err);
    return res.status(500).json({ error: "Failed to update member", details: err.message });
  }
};