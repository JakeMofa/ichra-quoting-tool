// server/models/ICHRAClass.js
const mongoose = require('mongoose');

const ichraClassSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },

    name: { type: String, required: true }, // e.g. "Full-time employees"
    description: { type: String },

    // Contribution rules
    employee_contribution: { type: Number, required: true },   // monthly $ employer contributes for employee
    dependent_contribution: { type: Number, required: true },  // monthly $ employer contributes for dependents

    // Optional: sub-classes (like age bands)
    subclass: { type: String }, // e.g. "Under 30", "30-50", "50+"

    // Members assigned to this class
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('ICHRAClass', ichraClassSchema);
