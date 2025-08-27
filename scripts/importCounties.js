const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const County = require('../models/County');

mongoose.connect(process.env.MONGO_URI)
  .then(() => importCounties())
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

function importCounties() {
  const results = [];

  fs.createReadStream('data/counties.csv')
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        countyCode: data.county_code?.trim(),
        countyName: data.county_name?.trim(),
        state: data.state?.trim()
      });
    })
    .on('end', async () => {
      try {
        await County.deleteMany({});
        await County.insertMany(results);
        console.log(`Imported ${results.length} counties`);
        mongoose.disconnect();
      } catch (err) {
        console.error('Error inserting counties:', err);
        mongoose.disconnect();
      }
    });
}
