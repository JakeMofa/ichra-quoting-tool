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

module.exports = mongoose.model('Pricing', pricingSchema);
