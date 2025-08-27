const mongoose = require('mongoose');

const serviceAreaZipCountySchema = new mongoose.Schema(
  {
    service_area_id: { type: String, required: true }, // from CSV "service_area_id"
    county_id: { type: String, required: true },       // from CSV "county_id"
    zip_code_id: { type: String, required: true }      // from CSV "zip_code_id"
  },
  { timestamps: true }
);

// composite index so one service_area/county/zip combo is unique
serviceAreaZipCountySchema.index(
  { service_area_id: 1, county_id: 1, zip_code_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('ServiceAreaZipCounty', serviceAreaZipCountySchema);
