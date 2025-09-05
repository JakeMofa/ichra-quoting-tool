// server/models/ICHRAClass.js
const mongoose = require('mongoose');

const ichraClassSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },

    // e.g. "Full-time employees"
    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Monthly employer contributions
    employee_contribution: { type: Number, required: true },   // for employee
    dependent_contribution: { type: Number, required: true },  // for dependents

    // Optional subclassing:
    // - parent_class points to a base class (e.g., "Full-time employees")
    // - subclass names the band (e.g., "Age 30–39")
    parent_class: { type: mongoose.Schema.Types.ObjectId, ref: "ICHRAClass", default: null },
    subclass: { type: String, default: null },

    // Mark seeded/common classes if you want to prevent duplicates to help preopoluate  faster rather than one
    is_default: { type: Boolean, default: false },

    // Members assigned to this class
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }]
  },
  { timestamps: true }
);

// Helpful index for queries by group
ichraClassSchema.index({ group: 1, name: 1, subclass: 1 }, { unique: false });

// Avoid duplicate class names under same parent within a group
ichraClassSchema.index({ group: 1, name: 1, parent_class: 1 }, { unique: true });

module.exports = mongoose.model('ICHRAClass', ichraClassSchema);


