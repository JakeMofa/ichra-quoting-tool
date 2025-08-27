// server/models/Group.js
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  external_id: String,
  fips_code: String,
  name: String,
  number_of_employees: Number,
  primary: Boolean,
  zip_code: String,
  ideon_location_id: String // ID returned from Ideon for location
});

const groupSchema = new mongoose.Schema(
  {
    // Employer info
    company_name: { type: String, required: true },    // Matches Ideon `company_name`
    chamber_association: { type: Boolean, default: false },
    contact_name: { type: String },
    contact_email: { type: String },
    contact_phone: { type: String },
    external_id: { type: String },                     // Optional custom tracking
    sic_code: { type: String },                        // Standard Industrial Classification

    // Ideon reference
    ideon_group_id: { type: String },                  // Returned from Ideon API
    locations: [locationSchema],                       // Embedded array of locations

    // Our app logic
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ICHRAClass' }], 
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
