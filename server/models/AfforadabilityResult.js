// server/models/AffordabilityResult.js
const mongoose = require('mongoose');

const affordabilityResultSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },

    // Ideon API response fields
    fpl_percent: { type: Number, required: true },       // Federal Poverty Level %
    expected_contribution: { type: Number },             // Member contribution amount
    benchmark_plan_id: { type: String },                 // Second Lowest Cost Silver Plan ID
    benchmark_premium: { type: Number },                 // Premium for benchmark plan
    premium_tax_credit: { type: Number },                // Subsidy amount
    affordable: { type: Boolean, default: false },       // IRS affordability test

    raw_response: { type: Object }                       // Store full Ideon JSON response
  },
  { timestamps: true }
);

module.exports = mongoose.model('AffordabilityResult', affordabilityResultSchema);
