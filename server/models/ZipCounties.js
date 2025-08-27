const mongoose = require('mongoose');

const zipCountySchema = new mongoose.Schema(
  {
    record_id: { type: String, required: true, unique: true }, // from CSV "id"
    rating_area_id: { type: String, required: true },          // from CSV "rating_area_id"
    county_id: { type: String, required: true },               // from CSV "county_id"
    zip_code_id: { type: String, required: true }              // from CSV "zip_code_id"
  },
  { timestamps: true }
);

// Useful composite index for lookups
zipCountySchema.index({ zip_code_id: 1, county_id: 1 }, { unique: true });

module.exports = mongoose.model('ZipCounty', zipCountySchema);
