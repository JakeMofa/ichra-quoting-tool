const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const RatingArea = require('../server/models/RatingArea');

async function importRatingAreas() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'rating_areas.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const ratingAreas = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.id && row.state_id) {
        ratingAreas.push({
          rating_area_id: row.id.trim(), // from CSV "id"
          state_id: row.state_id.trim()  // from CSV "state_id"
        });
      }
    })
    .on('end', async () => {
      if (ratingAreas.length === 0) {
        console.warn('No rating areas parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await RatingArea.deleteMany({});
        await RatingArea.insertMany(ratingAreas, { ordered: false });
        console.log(`Imported ${ratingAreas.length} rating areas`);
      } catch (err) {
        console.error('Error inserting rating areas:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importRatingAreas();
