const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const PlanCounty = require('../server/models/PlanCounties');

async function importPlanCounties() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'plan_counties.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const planCounties = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.plan_id && row.county_id) {
        planCounties.push({
          plan_id: row.plan_id.trim(),     // from CSV "plan_id"
          county_id: row.county_id.trim()  // from CSV "county_id"
        });
      }
    })
    .on('end', async () => {
      if (planCounties.length === 0) {
        console.warn('No plan_county rows parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await PlanCounty.deleteMany({});
        await PlanCounty.insertMany(planCounties, { ordered: false });
        console.log(`Imported ${planCounties.length} plan_county records`);
      } catch (err) {
        console.error('Error inserting plan_counties:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importPlanCounties();
