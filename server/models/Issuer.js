const mongoose = require('mongoose');

const issuerSchema = new mongoose.Schema({
  issuerId: { type: String, required: true },
  issuerName: { type: String, required: true },
  state: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Issuer', issuerSchema);
