// Group ICHRAClass
const mongoose = require('mongoose');

const ichraClassSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  name: { type: String, required: true }, // e.g., "Full-Time Employees"
  subclass: String, // e.g., "Age 40-49"
  employeeContribution: { type: Number, required: true },
  dependentContribution: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ICHRAClass', ichraClassSchema);
