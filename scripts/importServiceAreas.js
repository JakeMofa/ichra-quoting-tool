const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const ServiceArea = require('../server/models/ServiceArea');

async function importServiceAreas() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'service_areas.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const serviceAreas = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.id && row.issuer_id && row.name) {
        serviceAreas.push({
          service_area_id: row.id.trim(), // from CSV "id"
          issuer_id: row.issuer_id.trim(), // from CSV "issuer_id"
          name: row.name.trim()           // from CSV "name"
        });
      }
    })
    .on('end', async () => {
      if (serviceAreas.length === 0) {
        console.warn('No service areas parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await ServiceArea.deleteMany({});
        await ServiceArea.insertMany(serviceAreas, { ordered: false });
        console.log(`Imported ${serviceAreas.length} service areas`);
      } catch (err) {
        console.error('Error inserting service areas:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importServiceAreas();
