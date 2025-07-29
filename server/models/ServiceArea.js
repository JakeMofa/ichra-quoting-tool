const mongoose = require('mongoose');

const serviceAreaSchema = new mongoose.Schema({
  serviceAreaId: { type: String, required: true },
  issuerId: { type: String, required: true },
  state: { type: String, required: true },
  isPartialCounty: { type: Boolean, default: false },
  countyFipsCodes: [String],  // optional, for mapping to counties
}, { timestamps: true });

module.exports = mongoose.model('ServiceArea', serviceAreaSchema);
