// server/models/Member.js
const mongoose = require("mongoose");

const dependentSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  dob: Date,
  gender: String,
  last_used_tobacco: Date, // Ideon requires null or date
  relationship: String,
  same_household: Boolean,
});

const memberSchema = new mongoose.Schema(
  {
    // Relationships
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    ichra_class: { type: mongoose.Schema.Types.ObjectId, ref: "ICHRAClass", required: false },
    ichra_class: { type: mongoose.Schema.Types.ObjectId, ref: "ICHRAClass", default: null },

    // Member basics
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    date_of_birth: { type: Date, required: false },
    gender: { type: String, enum: ["M", "F", "U"], default: "U" },
    last_used_tobacco: { type: Date, default: null },
    retiree: { type: Boolean, default: false },
    cobra: { type: Boolean, default: false },
    old_employer_contribution: { type: Number, default: 0 },
    old_employee_contribution: { type: Number, default: 0 },

    // Address + location (Ideon addMember requires fips_code + location_id)
    zip_code: {type: String,set: v => (v == null ? v : String(v).padStart(5, "0")), },
    fips_code: { type: String },
    location_id: { type: String }, // Ideon location ID

    // Household + affordability
    household_income: { type: Number },
    household_size: { type: Number },
    safe_harbor_income: { type: Number },
    annual_salary: { type: Number },
    hours_per_week: { type: Number },

    // Dependents
    dependents: [dependentSchema],

    // Ideon reference & matching key for affordability results
    ideon_member_id: { type: String },        // UUID from Ideon (if returned)
    external_id: { type: String, required: true }, // Key we send to Ideon & match on
  },
  { timestamps: true }
);

// Prevent duplicate external_ids within the same group
memberSchema.index({ group: 1, external_id: 1 }, { unique: true });

module.exports = mongoose.model("Member", memberSchema);
