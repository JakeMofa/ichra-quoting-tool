// server/controllers/groupController.js
const Group = require("../models/Group");
const ideon = require("../services/ideon");
const { v4: uuidv4 } = require("uuid");

exports.createGroup = async (req, res) => {
  const payload = req.body;
  console.log(">>> Inside createGroup controller, payload:", payload);

  let ideonGroupId;
  let ideonData = null;

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

  } catch (err) {
    // Explicitly log details of the failure
    console.warn(">>> Ideon createGroup failed:", err.response?.status, err.response?.data || err.message);
    // Always assign a mock ID
    ideonGroupId = `mock-${uuidv4()}`;
  }

  // Step 2: Always save to Mongo
  try {
    const groupDoc = new Group({
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      ideon_group_id: ideonGroupId,
      classes: [],
    });

    await groupDoc.save();
    console.log(">>> Group saved in MongoDB:", groupDoc._id);

    return res.status(201).json({
      message: "Group created successfully",
      group: groupDoc,
      ideon: ideonData, // will be null if fallback
    });
  } catch (dbErr) {
    console.error(">>> Error saving group in Mongo:", dbErr.message);
    return res.status(500).json({ error: "Failed to save group in Mongo" });
  }
};
