const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const ZipCounty = require('../server/models/ZipCounties');

async function importZipCounties() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'zip_counties.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const zipCounties = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.id && row.rating_area_id && row.county_id && row.zip_code_id) {
        zipCounties.push({
          record_id: row.id.trim(),            // from CSV "id"
          rating_area_id: row.rating_area_id.trim(),  // from CSV "rating_area_id"
          county_id: row.county_id.trim(),     // from CSV "county_id"
          zip_code_id: row.zip_code_id.trim()  // from CSV "zip_code_id"
        });
      }
    })
    .on('end', async () => {
      if (zipCounties.length === 0) {
        console.warn('No zip_county rows parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await ZipCounty.deleteMany({});
        await ZipCounty.insertMany(zipCounties, { ordered: false });
        console.log(`Imported ${zipCounties.length} zip_county records`);
      } catch (err) {
        console.error('Error inserting zip_counties:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importZipCounties();
