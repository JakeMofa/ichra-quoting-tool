// server/controllers/groupController.js
const Group = require("../models/Group");
const ideon = require("../services/ideon");
const mongoose = require("mongoose");
const AffordabilityResult = require("../models//AfforadabilityResult");
const Member = require("../models/Member");
const ICHRAClass = require("../models/ICHRAClass");
// add others if referenced (e.g., Quotes, AffordabilityResult)
const { v4: uuidv4 } = require("uuid");

// --- helper: trim group doc for responses ---
function transformGroupDoc(doc) {
  return {
    _id: doc._id,
    company_name: doc.company_name,
    contact_name: doc.contact_name,
    contact_email: doc.contact_email,
    contact_phone: doc.contact_phone,
    ideon_group_id: doc.ideon_group_id,
    locations: doc.locations?.map((loc) => ({
      external_id: loc.external_id,
      fips_code: loc.fips_code,
      name: loc.name,
      number_of_employees: loc.number_of_employees,
      primary: loc.primary,
      zip_code: loc.zip_code,
      ideon_location_id: loc.ideon_location_id,
    })),
    classes: doc.classes?.map((cls) => ({
      _id: cls._id,
      name: cls.name,
      description: cls.description,
      employee_contribution: cls.employee_contribution,
      dependent_contribution: cls.dependent_contribution,
      subclass: cls.subclass,
      members: cls.members, // just IDs
    })),
    createdAt: doc.createdAt,
  };
}

// --- create a group ---
exports.createGroup = async (req, res) => {
  const payload = req.body;
  console.log(">>> Inside createGroup controller, payload:", payload);

  let ideonGroupId;
  let ideonData = null;
  let locations = [];

  // Step 1: Try Ideon
  try {
    const ideonRes = await ideon.createGroup({
      group: {
        company_name: payload.company_name,
        contact_email: payload.contact_email,
        contact_name: payload.contact_name,
        contact_phone: payload.contact_phone,
        external_id: payload.external_id || `ext-${Date.now()}`,
        sic_code: payload.sic_code || "0700",
        chamber_association: payload.chamber_association || false,
      },
      locations: [
        {
          external_id: `loc-${Date.now()}`,
          fips_code: payload.fips_code || "36081",
          name: payload.location_name || "Headquarters",
          number_of_employees: payload.number_of_employees || 1,
          primary: true,
          zip_code: payload.zip_code || "11423",
        },
      ],
    });

    ideonGroupId = ideonRes.data.group.id;
    ideonData = ideonRes.data;
    console.log(">>> Ideon group created:", ideonGroupId);

    locations = ideonRes.data.locations.map((loc) => ({
      external_id: loc.external_id,
      fips_code: loc.fips_code,
      name: loc.name,
      number_of_employees: loc.number_of_employees,
      primary: loc.primary,
      zip_code: loc.zip_code,
      ideon_location_id: loc.id,
    }));
  } catch (err) {
    console.warn(">>> Ideon createGroup failed:", err.response?.status, err.response?.data || err.message);

    ideonGroupId = `mock-${uuidv4()}`;
    locations = [
      {
        external_id: `loc-${Date.now()}`,
        fips_code: payload.fips_code || "36081",
        name: payload.location_name || "Headquarters",
        number_of_employees: payload.number_of_employees || 1,
        primary: true,
        zip_code: payload.zip_code || "11423",
        ideon_location_id: `mock-${uuidv4()}`,
      },
    ];
  }

  // Step 2: Save to Mongo
  try {
    const groupDoc = new Group({
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      ideon_group_id: ideonGroupId,
      locations,
      classes: [],
    });

    await groupDoc.save();
    console.log(">>> Group saved in MongoDB:", groupDoc._id);

    return res.status(201).json({
      message: "Group created successfully",
      group: transformGroupDoc(groupDoc),
      ideon: ideonData, // may be null if fallback
    });
  } catch (dbErr) {
    console.error(">>> Error saving group in Mongo:", dbErr.message);
    return res.status(500).json({ error: "Failed to save group in Mongo" });
  }
};

// --- fetch single group (trimmed) ---
exports.getGroupById = async (req, res) => {
  const { groupId } = req.params;
  try {
    const group = await Group.findById(groupId).populate("classes");
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json(transformGroupDoc(group));
  } catch (err) {
    console.error(">>> Error fetching group:", err.message);
    return res.status(500).json({ error: "Failed to fetch group" });
  }
};

// --- list all groups (trimmed) ---
exports.listGroups = async (req, res) => {
  try {
    const groups = await Group.find().populate("classes");
    return res.json(
      groups.map(g => ({
        _id: g._id,
        name: g.company_name || g.name || g.legal_name || null,
        company_name: g.company_name ?? null,
        createdAt: g.createdAt,
        classes: Array.isArray(g.classes)
          ? g.classes.map(c => ({ _id: c._id, name: c.name, subclass: c.subclass }))
          : [],
      }))
    );
  } catch (err) {
    console.error(">>> Error listing groups:", err.message);
    return res.status(500).json({ error: "Failed to list groups" });
  }
};

// DELETE /api/groups/:groupId?mode=cascade&dry_run=true
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const mode = (req.query.mode || "single").toLowerCase(); // "single" or "cascade"
    const dryRun = String(req.query.dry_run || "false").toLowerCase() === "true";

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid groupId" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // counts for impact
    const [memberCount, classCount, affCount] = await Promise.all([
      Member.countDocuments({ group: groupId }),
      ICHRAClass.countDocuments({ group: groupId }),
      AffordabilityResult ? AffordabilityResult.countDocuments({ group: groupId }) : 0,
    ]);

    const impact = {
      group: { _id: String(group._id), name: group.company_name ?? group.name ?? null },
      will_delete: {
        members: memberCount,
        classes: classCount,
        affordability_results: affCount,
        dependents: "embedded within members (auto-removed)",
      },
    };

    // block shallow delete if children exist
    if (mode !== "cascade" && (memberCount || classCount || affCount)) {
      return res.status(409).json({
        error: "Group has related data. Use cascade mode to remove everything.",
        hint: `DELETE /api/groups/${groupId}?mode=cascade`,
        impact,
      });
    }

    // dry run = preview only
    if (dryRun) {
      return res.json({
        message: "Dry run only — nothing deleted.",
        mode,
        impact,
      });
    }

    // ---- ACTUAL DELETE (no sessions/transactions) ----
    if (mode === "cascade") {
      await Promise.all([
        Member.deleteMany({ group: groupId }),          // dependents embedded
        ICHRAClass.deleteMany({ group: groupId }),
        AffordabilityResult ? AffordabilityResult.deleteMany({ group: groupId }) : Promise.resolve(),
      ]);
    }
    await Group.deleteOne({ _id: groupId });

    return res.json({
      message: mode === "cascade" ? "Group and all related data deleted." : "Group deleted.",
      deleted: {
        group_id: String(groupId),
        members: mode === "cascade" ? memberCount : 0,
        classes: mode === "cascade" ? classCount : 0,
        affordability_results: mode === "cascade" ? affCount : 0,
      },
    });
  } catch (err) {
    console.error(">>> Error deleting group:", err);
    return res.status(500).json({ error: "Failed to delete group", details: err.message });
  }
};