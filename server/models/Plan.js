// model schema format

const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  plan_id: { type: String, required: true, unique: true },
  issuer_id: String,
  name: String,
  metal_level: String,
  is_hsa_eligible: Boolean,
  is_dental_only: Boolean,
  is_medicare: Boolean,
});

module.exports = mongoose.model('Plan', planSchema);
