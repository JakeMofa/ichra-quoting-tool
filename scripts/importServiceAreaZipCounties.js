const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const ServiceAreaZipCounty = require('../server/models/ServiceAreaZipCounty');

async function importServiceAreaZipCounties() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'service_area_zip_counties.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.service_area_id && row.county_id && row.zip_code_id) {
        records.push({
          service_area_id: row.service_area_id.trim(), // from CSV "service_area_id"
          county_id: row.county_id.trim(),             // from CSV "county_id"
          zip_code_id: row.zip_code_id.trim()          // from CSV "zip_code_id"
        });
      }
    })
    .on('end', async () => {
      if (records.length === 0) {
        console.warn('No service_area_zip_county rows parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await ServiceAreaZipCounty.deleteMany({});
        await ServiceAreaZipCounty.insertMany(records, { ordered: false });
        console.log(`Imported ${records.length} service_area_zip_county records`);
      } catch (err) {
        console.error('Error inserting service_area_zip_counties:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importServiceAreaZipCounties();
