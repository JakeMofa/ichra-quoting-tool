// server/controllers/groupController.js
const Group = require("../models/Group");
const ideon = require("../services/ideon");
const { v4: uuidv4 } = require("uuid");

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

    // Map Ideon’s locations into our Mongo format
    locations = ideonRes.data.locations.map(loc => ({
      external_id: loc.external_id,
      fips_code: loc.fips_code,
      name: loc.name,
      number_of_employees: loc.number_of_employees,
      primary: loc.primary,
      zip_code: loc.zip_code,
      ideon_location_id: loc.id   //  persist Ideon’s location ID
    }));

  } catch (err) {
    console.warn(">>> Ideon createGroup failed:", err.response?.status, err.response?.data || err.message);

    ideonGroupId = `mock-${uuidv4()}`;
    // fallback: still save a default location in Mongo
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

  // Step 2: Always save to Mongo
  try {
    const groupDoc = new Group({
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      ideon_group_id: ideonGroupId,
      locations: locations,   // store them in Mongo
      classes: [],
    });

    await groupDoc.save();
    console.log(">>> Group saved in MongoDB:", groupDoc._id);

    return res.status(201).json({
      message: "Group created successfully",
      group: groupDoc,
      ideon: ideonData, // may be null if fallback
    });
  } catch (dbErr) {
    console.error(">>> Error saving group in Mongo:", dbErr.message);
    return res.status(500).json({ error: "Failed to save group in Mongo" });
  }
};
