const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const ServiceArea = require('../models/ServiceArea');

mongoose.connect(process.env.MONGO_URI)
  .then(() => importServiceAreas())
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

function importServiceAreas() {
  const results = [];

  fs.createReadStream('data/service_areas.csv')
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        serviceAreaId: data.service_area_id?.trim(),
        issuerId: data.issuer_id?.trim(),
        state: data.state_code?.trim()
      });
    })
    .on('end', async () => {
      try {
        await ServiceArea.deleteMany({});
        await ServiceArea.insertMany(results);
        console.log(`Imported ${results.length} service areas`);
        mongoose.disconnect();
      } catch (err) {
        console.error('Error inserting service areas:', err);
        mongoose.disconnect();
      }
    });
}
