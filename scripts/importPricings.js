const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const Pricing = require('../server/models/Pricing');

async function importPricings() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'pricings.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const pricings = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const planId = row.plan_id?.trim();
      const ratingAreaId = row.rating_area_id?.trim();

      if (!planId || !ratingAreaId) return;

      // Loop through all ages 0–65
      for (let age = 0; age <= 65; age++) {
        const col = `age_${age}`;
        const colTobacco = `age_${age}_tobacco`;

        if (row[col]) {
          pricings.push({
            plan_id: planId,
            rating_area_id: ratingAreaId,
            age,
            tobacco: false,
            premium: parseFloat(row[col])
          });
        }

        if (row[colTobacco]) {
          pricings.push({
            plan_id: planId,
            rating_area_id: ratingAreaId,
            age,
            tobacco: true,
            premium: parseFloat(row[colTobacco])
          });
        }
      }
    })
    .on('end', async () => {
      if (pricings.length === 0) {
        console.warn('No pricings parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await Pricing.deleteMany({});
        await Pricing.insertMany(pricings, { ordered: false });
        console.log(`Imported ${pricings.length} pricing records`);
      } catch (err) {
        console.error('Error inserting pricings:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importPricings();
