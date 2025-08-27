const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const County = require('../server/models/Counties');

async function importCounties() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'counties.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const counties = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.id && row.name && row.state_id) {
        counties.push({
          county_id: row.id.trim(),                          // from CSV "id"
          name: row.name.trim(),                             // from CSV "name"
          state_id: row.state_id.trim(),                     // from CSV "state_id"
          rating_area_count: parseInt(row.rating_area_count, 10) || 0,   // from CSV "rating_area_count"
          service_area_count: parseInt(row.service_area_count, 10) || 0  // from CSV "service_area_count"
        });
      }
    })
    .on('end', async () => {
      if (counties.length === 0) {
        console.warn('No counties parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await County.deleteMany({});
        await County.insertMany(counties, { ordered: false });
        console.log(`Imported ${counties.length} counties`);
      } catch (err) {
        console.error('Error inserting counties:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importCounties();
