const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const RatingArea = require('../models/RatingArea');

mongoose.connect(process.env.MONGO_URI)
  .then(() => importRatingAreas())
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

function importRatingAreas() {
  const results = [];

  fs.createReadStream('data/rating_areas.csv')
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        ratingAreaId: data.rating_area_id?.trim(),
        state: data.state?.trim()
      });
    })
    .on('end', async () => {
      try {
        await RatingArea.deleteMany({});
        await RatingArea.insertMany(results);
        console.log(`Imported ${results.length} rating areas`);
        mongoose.disconnect();
      } catch (err) {
        console.error('Error inserting rating areas:', err);
        mongoose.disconnect();
      }
    });
}
