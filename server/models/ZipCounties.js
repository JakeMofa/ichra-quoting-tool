// server/models/ZipCounty.js
const mongoose = require("mongoose");

const zipCountySchema = new mongoose.Schema(
  {
    record_id: { type: String, required: true, unique: true }, // from CSV "id"
    rating_area_id: { type: String, required: true },          // from CSV "rating_area_id"
    county_id: { type: String, required: true },               // from CSV "county_id"
    zip_code_id: { type: String, required: true },             // from CSV "zip_code_id" (actual 5-digit ZIP)
  },
  { timestamps: true }
);

//  Indexes for quoting
// Find all counties for a ZIP
zipCountySchema.index({ zip_code_id: 1 });

// Ensure no duplicate county assignments per ZIP
zipCountySchema.index({ zip_code_id: 1, county_id: 1 }, { unique: true });

module.exports = mongoose.model("ZipCounty", zipCountySchema);