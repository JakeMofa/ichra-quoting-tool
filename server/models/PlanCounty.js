// Server for PLanCounty.js

const mongoose = require('mongoose');

const planCountySchema = new mongoose.Schema({
  plan_id: { type: String, required: true },
  county_id: String,
});

module.exports = mongoose.model('PlanCounty', planCountySchema);