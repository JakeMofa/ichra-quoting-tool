// server/controllers/groupController.js
const Group = require("../models/Group");
const ideon = require("../services/ideon");
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
    return res.json(groups.map(transformGroupDoc));
  } catch (err) {
    console.error(">>> Error listing groups:", err.message);
    return res.status(500).json({ error: "Failed to list groups" });
  }
};
