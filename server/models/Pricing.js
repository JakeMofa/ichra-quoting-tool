//server/models/Pricing.js
const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema(
  {
    plan_id: { type: String, required: true, index: true },  // FK to Plan
    rating_area_id: { type: String, required: true },        // from CSV
    age: { type: Number, required: true },                   // 0–65
    tobacco: { type: Boolean, required: true },              // true if *_tobacco column
    premium: { type: Number, required: true }                // price value
  },
  { timestamps: true }
);

//  fast look up from plan list
pricingSchema.index({ plan_id: 1, age: 1, tobacco: 1 });

// if  support “price by rating area without plan list”: // optional
pricingSchema.index({ rating_area_id: 1, age: 1, tobacco: 1 });

module.exports = mongoose.model('Pricing', pricingSchema);
