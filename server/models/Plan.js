const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  plan_id: { type: String, required: true, unique: true },
  carrier_name: String,
  display_name: String,
  effective_date: Date,
  expiration_date: Date,
  name: String,
  plan_type: String,
  service_area_id: String,
  source: String,
  type: String,
  plan_market: String,
  on_market: Boolean,
  off_market: Boolean,
  metal_level: String,
  issuer_id: String,
});

module.exports = mongoose.model("Plan", planSchema);
