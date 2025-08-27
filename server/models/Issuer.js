const mongoose = require('mongoose');

const issuerSchema = new mongoose.Schema(
  {
    issuer_id: { type: String, required: true, unique: true }, // from CSV "id"
    name: { type: String, required: true },                    // from CSV "name"
    alternate_name: { type: String },                          // from CSV "alternate_name"
    logo_path: { type: String }                                // from CSV "logo_path"
  },
  { timestamps: true }
);

module.exports = mongoose.model('Issuer', issuerSchema);
