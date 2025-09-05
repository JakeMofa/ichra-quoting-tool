// server/models/AffordabilityResult.js
const mongoose = require("mongoose");

const affordabilityResultSchema = new mongoose.Schema(
  {
    // Required links
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },

    // Fields that Ideon  returns
    minimum_employer_contribution: { type: Number },          // $ required to be affordable for this member
    fpl_minimum_employer_contribution: { type: Number },      // same calc but using FPL income
    premium_tax_credit: { type: Number },                     // PTC from Ideon
    benchmark_plan_id: { type: String },                      // SLCSP id (2nd lowest silver)
    benchmark_premium: { type: Number },                      // SLCSP premium

    // Convenience flag for UI
    affordable: { type: Boolean, default: false },

    // Keep the whole payload for future needs / debugging
    raw_response: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AffordabilityResult", affordabilityResultSchema);
