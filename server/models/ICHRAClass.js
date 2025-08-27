// server/models/ICHRAClass.js
const mongoose = require('mongoose');

const ichraClassSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true }, // Employer link
    name: { type: String, required: true },        // Class name (e.g. "Full-time TX Staff")

    contribution_type: { 
      type: String, 
      enum: ['fixed', 'percentage'], 
      required: true 
    },
    contribution_value: { type: Number, required: true }, // e.g. 300 (fixed $) or 70 (%)
    
    ideon_class_id: { type: String },              // ID returned from Ideon API
  },
  { timestamps: true }
);

module.exports = mongoose.model('ICHRAClass', ichraClassSchema);
