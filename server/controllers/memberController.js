// server/controllers/memberController.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const Member = require("../models/Member");
const Group = require("../models/Group");
const ZipCounty = require("../models/ZipCounties");
const ICHRAClass = require("../models/ICHRAClass");
const ideon = require("../services/ideon");

// --- helpers ---
function genExternalId() {
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function parseDOB(payload) {
  const d = payload.dob || payload.date_of_birth;
  return d ? new Date(d) : new Date("1990-01-01");
}
function normZip5(z) {
  if (!z && z !== 0) return null;
  const s = String(z).trim();
  const z5 = s.padStart(5, "0").slice(0, 5);
  return /^\d{5}$/.test(z5) ? z5 : null;
}

// Resolve county FIPS for a given ZIP from zip_counties
async function resolveFipsForZip(zip) {
  if (!zip) return null;

  // match either string or number representations
  const rows = await ZipCounty.find({
    $or: [{ zip_code_id: String(zip) }, { zip_code_id: Number(zip) }],
  }).lean();

  if (!rows || rows.length === 0) return null;

  // dedupe list of county_ids and pick deterministically so flow doesn't block
  const countyIds = [...new Set(rows.map((r) => r.county_id))].sort();
  return countyIds[0] || null;
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

    // 2) Normalize/prepare incoming fields
    const zipCode = normZip5(payload.zip_code);
    if (!zipCode) {
      return res.status(400).json({ error: "zip_code must be 5 digits" });
    }

    // Prefer client-provided fips_code; otherwise auto-resolve from zip_counties
    let fipsCode =
      (payload.fips_code && String(payload.fips_code).trim()) || null;

    if (!fipsCode) {
      try {
        const autoFips = await resolveFipsForZip(zipCode);
        if (autoFips) {
          fipsCode = autoFips;
          console.log(
            `>>> Auto-resolved fips_code ${autoFips} for ZIP ${zipCode}`
          );
        } else {
          console.log(
            `>>> No FIPS found for ZIP ${zipCode} — Ideon may reject if group location FIPS mismatches`
          );
        }
      } catch (e) {
        console.warn(">>> FIPS auto-resolution failed:", e.message);
      }
    }

    // Choose a work location for the member (first group location by default)
    const groupLoc = (group.locations && group.locations[0]) || {};
    // Allow overrides from payload if the UI sends them explicitly
    const locationId =
      payload.location_id ||
      groupLoc.ideon_location_id ||
      groupLoc.location_id ||
      null;

    // 3) external_id is REQUIRED (unique per group; your model enforces indexing)
    const externalId = payload.external_id || genExternalId();

    // 4) Try Ideon addMember if we have ideon_group_id and required fields
    try {
      if (!group.ideon_group_id) throw new Error("Missing ideon_group_id on group");

      const ideonPayload = {
        members: [
          {
            first_name: payload.first_name,
            last_name: payload.last_name,
            date_of_birth:
              payload.dob || payload.date_of_birth || "1990-01-01",
            gender: payload.gender || "U",

            // geography — prefer member ZIP/FIPS; fallback to group location only if missing
            zip_code: zipCode || groupLoc.zip_code || null,
            fips_code: fipsCode || groupLoc.fips_code || null,
            location_id: locationId, // required by Ideon

            // flags
            cobra: false,
            retiree: false,
            last_used_tobacco: null,

            // dependents + affordability inputs (optional)
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
      const ideonRes = await ideon.addMember(
        group.ideon_group_id,
        ideonPayload
      );

      if (ideonRes?.data?.members?.length) {
        ideonMemberId = ideonRes.data.members[0].id || null;
        ideonData = ideonRes.data.members[0];
        console.log(">>> Ideon member created:", ideonMemberId);
      } else {
        ideonMemberId = `mock-${uuidv4()}`;
        console.warn(
          ">>> Ideon addMember returned no members array, using mock id"
        );
      }
    } catch (err) {
      console.warn(
        ">>> Ideon addMember failed, falling back:",
        err.response?.data || err.message
      );
      ideonMemberId = `mock-${uuidv4()}`;
    }

    // 5) Save to Mongo — persist external_id, fips_code, location_id, MAGI inputs
    const memberDoc = new Member({
      group: groupId,
      ichra_class: payload.ichra_class || null,

      first_name: payload.first_name,
      last_name: payload.last_name,
      date_of_birth: parseDOB(payload),
      gender: payload.gender || "U",

      zip_code: zipCode,
      fips_code: fipsCode,
      location_id: locationId,

      dependents: payload.dependents || [],

      // household + affordability (optional)
      household_income: payload.household_income,
      safe_harbor_income: payload.safe_harbor_income,
      household_size: payload.household_size,

      // MAGI inputs (optional)
      agi: payload.agi,
      nontaxable_social_security: payload.nontaxable_social_security,
      tax_exempt_interest: payload.tax_exempt_interest,
      foreign_earned_income: payload.foreign_earned_income,
      tax_year: payload.tax_year,

      //  : prior contributions (internal-only; NOT sent to Ideon)
      old_employer_contribution: payload.old_employer_contribution ?? null,
      old_employee_contribution: payload.old_employee_contribution ?? null,

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

        old_employer_contribution: memberDoc.old_employer_contribution,
        old_employee_contribution: memberDoc.old_employee_contribution,

        ichra_class: memberDoc.ichra_class,
        household_income: memberDoc.household_income,
        safe_harbor_income: memberDoc.safe_harbor_income,
        household_size: memberDoc.household_size,

        // echo MAGI inputs
        agi: memberDoc.agi,
        nontaxable_social_security: memberDoc.nontaxable_social_security,
        tax_exempt_interest: memberDoc.tax_exempt_interest,
        foreign_earned_income: memberDoc.foreign_earned_income,
        tax_year: memberDoc.tax_year,

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
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: "Duplicate external_id for this group" });
    }
    return res.status(500).json({ error: "Failed to create member" });
  }
};

// GET /api/groups/:groupId/members
exports.getMembersByGroup = async (req, res) => {
  try {
    const members = await Member.find({ group: req.params.groupId }).populate({
      path: "ichra_class",
      model: "ICHRAClass",
    });
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

        old_employer_contribution: m.old_employer_contribution,
        old_employee_contribution: m.old_employee_contribution,

        // MAGI inputs
        agi: m.agi,
        nontaxable_social_security: m.nontaxable_social_security,
        tax_exempt_interest: m.tax_exempt_interest,
        foreign_earned_income: m.foreign_earned_income,
        tax_year: m.tax_year,

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
    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).json({ error: "Invalid groupId or memberId" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = await Member.findById(memberId);
    if (!member || member.group?.toString() !== groupId) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    const {
      ichra_class, // ObjectId of ICHRAClass
      old_employer_contribution, // Number
      old_employee_contribution, // Number

      // optional household & location
      household_income,
      safe_harbor_income,
      household_size,
      zip_code,
      fips_code,
      location_id,
      gender,
      date_of_birth,

      // MAGI inputs
      agi,
      nontaxable_social_security,
      tax_exempt_interest,
      foreign_earned_income,
      tax_year,

      // dependents update (array of objects)
      dependents
    } = req.body || {};

    // Track old class for membership maintenance
    const prevClassId = member.ichra_class ? member.ichra_class.toString() : null;

    // (1) Reassign class if provided (and belongs to this group)
    if (ichra_class) {
      if (!mongoose.Types.ObjectId.isValid(ichra_class)) {
        return res.status(400).json({ error: "Invalid ichra_class id" });
      }
      const klass = await ICHRAClass.findById(ichra_class);
      if (!klass || klass.group.toString() !== groupId) {
        return res
          .status(400)
          .json({ error: "ichra_class does not belong to this group" });
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
    if (household_income != null)
      member.household_income = Number(household_income);
    if (safe_harbor_income != null)
      member.safe_harbor_income = Number(safe_harbor_income);
    if (household_size != null) member.household_size = Number(household_size);

    // (4) MAGI inputs
    if (agi != null) member.agi = Number(agi);
    if (nontaxable_social_security != null)
      member.nontaxable_social_security = Number(nontaxable_social_security);
    if (tax_exempt_interest != null)
      member.tax_exempt_interest = Number(tax_exempt_interest);
    if (foreign_earned_income != null)
      member.foreign_earned_income = Number(foreign_earned_income);
    if (tax_year != null) member.tax_year = Number(tax_year);

    
    // (5) Location & demographic updates
    if (zip_code != null) {
      const z5 = normZip5(zip_code);
      if (!z5) {
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

    // (5b) Basic identity fields (optional)
    if (req.body.first_name != null) member.first_name = String(req.body.first_name);
    if (req.body.last_name  != null) member.last_name  = String(req.body.last_name);

    // (6) Dependents array (replace if provided)
    if (Array.isArray(dependents)) {
      member.dependents = dependents.map(dep => ({
        first_name: dep.first_name ?? null,
        last_name: dep.last_name ?? null,
        dob: dep.dob ? new Date(dep.dob) : null,
        gender: dep.gender ?? null,
        last_used_tobacco: dep.last_used_tobacco ? new Date(dep.last_used_tobacco) : null,
        relationship: dep.relationship ?? null,
        same_household: dep.same_household ?? null,
      }));
    }

    await member.save();

    // (7) If class changed, maintain membership arrays on ICHRAClass
    const newClassId = member.ichra_class ? member.ichra_class.toString() : null;
    if (newClassId && newClassId !== prevClassId) {
      // pull from old
      if (prevClassId) {
        await ICHRAClass.updateOne(
          { _id: prevClassId },
          { $pull: { members: member._id } }
        );
      }
      // push to new (avoid dup)
      await ICHRAClass.updateOne(
        { _id: newClassId },
        { $addToSet: { members: member._id } }
      );
    }

    // Final response
    return res.json({ message: "Member updated successfully", member });
  } catch (err) {
    console.error(">>> Error updating member:", err);
    return res
      .status(500)
      .json({ error: "Failed to update member", details: err.message });
  }
};

// GET /api/groups/:groupId/members/:memberId
exports.getMemberById = async (req, res) => {
  const { groupId, memberId } = req.params;
  try {
    const m = await Member.findOne({ _id: memberId, group: groupId }).populate({
      path: "ichra_class",
      model: "ICHRAClass",
    });
    if (!m) return res.status(404).json({ error: "Member not found" });
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch member" });
  }
};


// DELETE /api/groups/:groupId/members/:memberId
exports.deleteMember = async (req, res) => {
  const { groupId, memberId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Invalid groupId or memberId" });
    }

    const member = await Member.findById(memberId);
    if (!member || member.group.toString() !== groupId) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    // unlink from class if needed
    if (member.ichra_class) {
      await ICHRAClass.findByIdAndUpdate(member.ichra_class, { $pull: { members: member._id } });
    }

    await member.deleteOne();
    return res.json({ message: "Member deleted successfully", memberId });
  } catch (err) {
    console.error(">>> Error deleting member:", err);
    return res.status(500).json({ error: "Failed to delete member" });
  }
};

// PATCH /api/groups/:groupId/members/:memberId/dependents/:dependentId
exports.updateDependent = async (req, res) => {
  const { groupId, memberId, dependentId } = req.params;
  try {
    if (![groupId, memberId, dependentId].every(mongoose.Types.ObjectId.isValid)) {
      return res.status(400).json({ error: "Invalid id(s)" });
    }

    const member = await Member.findOne({ _id: memberId, group: groupId });
    if (!member) return res.status(404).json({ error: "Member not found in this group" });

    const dep = member.dependents.id(dependentId);
    if (!dep) return res.status(404).json({ error: "Dependent not found" });

    const {
      first_name, last_name, dob, gender,
      last_used_tobacco, relationship, same_household
    } = req.body || {};

    if (first_name != null) dep.first_name = String(first_name);
    if (last_name  != null) dep.last_name  = String(last_name);
    if (dob        != null) dep.dob        = new Date(dob);
    if (gender     != null) dep.gender     = String(gender);
    if (relationship    != null) dep.relationship    = String(relationship);
    if (same_household  != null) dep.same_household  = Boolean(same_household);
    if (last_used_tobacco !== undefined)
      dep.last_used_tobacco = last_used_tobacco ? new Date(last_used_tobacco) : null;

    await member.save();

    // Re-grab the persisted subdoc and return *that*
    const fresh = member.dependents.id(dependentId);
    return res.json({
      message: "Dependent updated successfully",
      dependent: fresh ? fresh.toObject() : null, // <- key change
    });
  } catch (err) {
    console.error(">>> Error updating dependent:", err);
    return res.status(500).json({ error: "Failed to update dependent" });
  }
};

// DELETE /api/groups/:groupId/members/:memberId/dependents/:dependentId
exports.deleteDependent = async (req, res) => {
  const { groupId, memberId, dependentId } = req.params;
  try {
    if (![groupId, memberId, dependentId].every(mongoose.Types.ObjectId.isValid)) {
      return res.status(400).json({ error: "Invalid id(s)" });
    }

    const member = await Member.findOne({ _id: memberId, group: groupId });
    if (!member) return res.status(404).json({ error: "Member not found in this group" });

    const dep = member.dependents.id(dependentId);
    if (!dep) return res.status(404).json({ error: "Dependent not found" });

    //  Mongoose 6/7-safe removal
    dep.deleteOne();                 // alternative: member.dependents.pull(dependentId)
    member.markModified("dependents");
    await member.save();

    return res.json({ message: "Dependent deleted successfully", dependentId });
  } catch (err) {
    console.error(">>> Error deleting dependent:", err);
    return res.status(500).json({ error: "Failed to delete dependent", details: err.message });
  }
};