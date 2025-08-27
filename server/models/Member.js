// server/models/Member.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    ichra_class: { type: mongoose.Schema.Types.ObjectId, ref: 'ICHRAClass', required: true },

    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    dob: { type: Date, required: true },          // Date of birth
    tobacco_user: { type: Boolean, default: false },

    zip: { type: String, required: true },
    state: { type: String, required: true },

    dependents: [
      {
        first_name: String,
        last_name: String,
        dob: Date,
        tobacco_user: { type: Boolean, default: false },
        relationship: { type: String }, // spouse, child, etc.
      }
    ],

    ideon_member_id: { type: String },            // ID returned from Ideon API
  },
  { timestamps: true }
);

module.exports = mongoose.model('Member', memberSchema);
