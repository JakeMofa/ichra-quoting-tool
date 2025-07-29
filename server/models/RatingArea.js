const mongoose = require('mongoose');

const ratingAreaSchema = new mongoose.Schema({
  ratingAreaId: { type: String, required: true },
  state: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RatingArea', ratingAreaSchema);
