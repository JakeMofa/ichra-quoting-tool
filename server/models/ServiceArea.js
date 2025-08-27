const mongoose = require('mongoose');

const serviceAreaSchema = new mongoose.Schema(
  {
    service_area_id: { type: String, required: true, unique: true }, // from CSV "id"
    issuer_id: { type: String, required: true },                     // from CSV "issuer_id"
    name: { type: String, required: true }                           // from CSV "name"
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceArea', serviceAreaSchema);
