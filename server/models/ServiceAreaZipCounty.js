const mongoose = require('mongoose');

const serviceAreaZipCountySchema = new mongoose.Schema({
  serviceAreaId: { type: String, required: true },
  zipCode: { type: String, required: true },
  countyFips: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('ServiceAreaZipCounty', serviceAreaZipCountySchema);
