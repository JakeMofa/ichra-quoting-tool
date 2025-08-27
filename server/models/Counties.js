const mongoose = require('mongoose');

const countySchema = new mongoose.Schema(
  {
    county_id: { type: String, required: true, unique: true }, // from CSV "id"
    name: { type: String, required: true },                    // from CSV "name"
    state_id: { type: String, required: true },                // from CSV "state_id"
    rating_area_count: { type: Number },                       // from CSV "rating_area_count"
    service_area_count: { type: Number }                       // from CSV "service_area_count"
  },
  { timestamps: true }
);

module.exports = mongoose.model('County', countySchema);
