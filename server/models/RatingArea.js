const mongoose = require('mongoose');

const ratingAreaSchema = new mongoose.Schema(
  {
    rating_area_id: { type: String, required: true, unique: true }, // from CSV "id"
    state_id: { type: String, required: true }                      // from CSV "state_id"
  },
  { timestamps: true }
);

module.exports = mongoose.model('RatingArea', ratingAreaSchema);
