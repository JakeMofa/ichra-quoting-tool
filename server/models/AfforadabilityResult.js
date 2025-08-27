// server/models/AffordabilityResult.js
const mongoose = require('mongoose');

const affordabilityResultSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },

    fpl_percent: Number,               // % of Federal Poverty Level
    expected_contribution: Number,     // Member contribution amount
    benchmark_plan_id: String,         // Plan ID used as benchmark
    benchmark_premium: Number,         // Premium for benchmark plan
    subsidy: Number,                   // Calculated subsidy if any

    raw_response: mongoose.Schema.Types.Mixed, // Store full API payload for debugging
  },
  { timestamps: true }
);

module.exports = mongoose.model('AffordabilityResult', affordabilityResultSchema);
