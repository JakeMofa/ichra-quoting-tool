// server/models/AffordabilityResult.js
const mongoose = require("mongoose");

const affordabilityResultSchema = new mongoose.Schema(
  {
    // Links this result to a specific member (required for affordability checks)
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },

    // Links this result back to the group
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },

    // Key fields parsed out from Ideon’s API response
    fpl_percent: { type: Number, required: true },          // Federal Poverty Level %
    expected_contribution: { type: Number },                // Member contribution ($)
    benchmark_plan_id: { type: String },                    // 2nd Lowest Cost Silver Plan ID
    benchmark_premium: { type: Number },                    // Premium for benchmark plan
    premium_tax_credit: { type: Number },                   // Subsidy amount
    affordable: { type: Boolean, default: false },          // IRS affordability test result

    // Raw Ideon JSON stored in case we need extra fields later
    raw_response: { type: Object }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AffordabilityResult", affordabilityResultSchema);
