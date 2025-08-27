const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const ServiceAreaZipCounty = require('../models/ServiceAreaZipCounty');

mongoose.connect(process.env.MONGO_URI)
  .then(() => importMappings())
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

function importMappings() {
  const results = [];

  fs.createReadStream('data/service_area_zip_counties.csv')
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        serviceAreaId: data.service_area_id?.trim(),
        zipCode: data.zip_code?.trim(),
        countyCode: data.county_code?.trim(),
        state: data.state_code?.trim()
      });
    })
    .on('end', async () => {
      try {
        await ServiceAreaZipCounty.deleteMany({});
        await ServiceAreaZipCounty.insertMany(results);
        console.log(`Imported ${results.length} zip/county mappings`);
        mongoose.disconnect();
      } catch (err) {
        console.error('Error inserting service area zip county mappings:', err);
        mongoose.disconnect();
      }
    });
}
