// server/models/Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },         // Employer name
    ein: { type: String },                          // Optional Employer Identification Number
    contact_name: { type: String },                 // Main contact person
    contact_email: { type: String },                // Contact email
    contact_phone: { type: String },                // Contact phone

    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
    },

    ideon_group_id: { type: String },               // ID returned from Ideon API
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ICHRAClass' }], // Associated classes
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
