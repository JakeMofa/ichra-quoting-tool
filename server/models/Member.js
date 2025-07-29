//model schema for member
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'ICHRAClass', required: true },
  name: String,
  age: Number,
  zipCode: String,
  tobaccoUse: { type: Boolean, default: false },
  previousEmployerContribution: Number,
  previousEmployeeContribution: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Member', memberSchema);
