//server/models/PlanCounties.js

const mongoose = require('mongoose');

const planCountySchema = new mongoose.Schema(
  {
    plan_id: { type: String, required: true },   // from CSV "plan_id"
    county_id: { type: String, required: true }  // from CSV "county_id"
  },
  { timestamps: true }
);

// unique composite index to avoid duplicates
planCountySchema.index({ plan_id: 1, county_id: 1 }, { unique: true });

// Fast county -> plans
planCountySchema.index({ county_id: 1 });

module.exports = mongoose.model('PlanCounty', planCountySchema);
