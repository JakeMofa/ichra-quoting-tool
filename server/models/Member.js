// server/models/Member.js
const mongoose = require('mongoose');

const dependentSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  dob: Date,
  gender: String,
  last_used_tobacco: Date,       // Ideon requires null or date
  relationship: String,
  same_household: Boolean
});

const memberSchema = new mongoose.Schema(
  {
    // Relationships
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    ichra_class: { type: mongoose.Schema.Types.ObjectId, ref: 'ICHRAClass', required: true },

    // Member basics
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    date_of_birth: { type: Date, required: true },  // match Ideon
    gender: { type: String, enum: ['M', 'F'] },
    last_used_tobacco: { type: Date, default: null },
    retiree: { type: Boolean, default: false },
    cobra: { type: Boolean, default: false },

    // Address + location
    zip_code: { type: String, required: true },
    fips_code: { type: String },
    location_id: { type: String },                  // match Ideon location ID

    // Household + affordability
    household_income: { type: Number },
    household_size: { type: Number },
    safe_harbor_income: { type: Number },
    annual_salary: { type: Number },
    hours_per_week: { type: Number },

    dependents: [dependentSchema],

    // Ideon reference
    ideon_member_id: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Member', memberSchema);
