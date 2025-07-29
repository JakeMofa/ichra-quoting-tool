//  Schema models/Pricing.js
const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  plan_id: { type: String, required: true },
  age: Number,
  tobacco: Boolean,
  premium: Number,
});

module.exports = mongoose.model('Pricing', pricingSchema);
