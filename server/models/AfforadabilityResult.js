//schema model for affordabliltiy
const mongoose = require('mongoose');

const affordabilitySchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  fplPercentage: Number,
  applicablePercentage: Number,
  expectedContribution: Number,
  benchmarkPremium: Number,
  subsidyAmount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AffordabilityResult', affordabilitySchema);
