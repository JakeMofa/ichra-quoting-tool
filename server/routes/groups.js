// server/routes/groups.js
const express = require('express');
const router = express.Router();

const Group = require('../models/Group');
const { createGroup } = require('../services/ideon');

// POST /api/groups// Docs
// Create group in Ideon and stores it in MongoDB
router.post('/', async (req, res) => {
  try {
    const payload = req.body;

    // Step 1: Create group in Ideon
    const ideonRes = await createGroup({
      group: {
        company_name: payload.company_name,
        contact_email: payload.contact_email,
        contact_name: payload.contact_name,
        contact_phone: payload.contact_phone,
        external_id: payload.external_id || `ext-${Date.now()}`,
        sic_code: payload.sic_code || "0700",
        chamber_association: payload.chamber_association || false
      },
      locations: [
        {
          external_id: `loc-${Date.now()}`,
          fips_code: payload.fips_code || "36081", // fallback to Brooklyn
          name: payload.location_name || "Headquarters",
          number_of_employees: payload.number_of_employees || 1,
          primary: true,
          zip_code: payload.zip_code || "11423"
        }
      ]
    });

    // Step 2: Save group in MongoDB
    const groupDoc = new Group({
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      ideon_group_id: ideonRes.data.group.id,
      classes: []
    });

    await groupDoc.save();

    res.status(201).json({
      message: "Group created successfully",
      group: groupDoc,
      ideon: ideonRes.data
    });

  } catch (err) {
    console.error("Error creating group:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data || "Failed to create group"
    });
  }
});

module.exports = router;
