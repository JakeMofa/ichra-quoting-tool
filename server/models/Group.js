// Models for Group
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  industry: String,
  location: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
