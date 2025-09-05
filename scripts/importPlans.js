const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const Plan = require('../server/models/plan.js');

async function importPlans() {
  await connectDB();

  const filePath = path.join(__dirname, '..', 'data', 'plans.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const plans = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.id) {
        plans.push({
          ...row, // spreads all fields directly
          plan_id: row.id.trim(),
          effective_date: row.effective_date ? new Date(row.effective_date) : null,
          expiration_date: row.expiration_date ? new Date(row.expiration_date) : null,
          updated_at: row.updated_at ? new Date(row.updated_at) : null,
          _release_date: row._release_date ? new Date(row._release_date) : null,
          on_market: row.on_market?.toLowerCase() === 'true',
          off_market: row.off_market?.toLowerCase() === 'true',
          hsa_eligible: row.hsa_eligible?.toLowerCase() === 'true',
          adult_dental: row.adult_dental?.toLowerCase() === 'true',
          age29_rider: row.age29_rider?.toLowerCase() === 'true',
          actively_marketed: row.actively_marketed?.toLowerCase() === 'true',
          standardized_plan: row.standardized_plan?.toLowerCase() === 'true',
          _carrier_testing: row._carrier_testing?.toLowerCase() === 'true',
          _embargo: row._embargo?.toLowerCase() === 'true',
          actuarial_value: row.actuarial_value ? parseFloat(row.actuarial_value) : null,
          essential_health_benefits_percentage: row.essential_health_benefits_percentage
            ? parseFloat(row.essential_health_benefits_percentage)
            : null,
          premium: row.premium ? parseFloat(row.premium) : null,
          premium_subsidized: row.premium_subsidized ? parseFloat(row.premium_subsidized) : null,
          cms_quality_ratings_overall: row.cms_quality_ratings_overall
            ? parseFloat(row.cms_quality_ratings_overall)
            : null,
          cms_quality_ratings_medical_care: row.cms_quality_ratings_medical_care
            ? parseFloat(row.cms_quality_ratings_medical_care)
            : null,
          cms_quality_ratings_member_experience: row.cms_quality_ratings_member_experience
            ? parseFloat(row.cms_quality_ratings_member_experience)
            : null,
          cms_quality_ratings_plan_administration: row.cms_quality_ratings_plan_administration
            ? parseFloat(row.cms_quality_ratings_plan_administration)
            : null
        });
      }
    })
    .on('end', async () => {
      if (plans.length === 0) {
        console.warn('No plans parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        await Plan.deleteMany({});
        await Plan.insertMany(plans, { ordered: false });
        console.log(`Imported ${plans.length} plans`);
      } catch (err) {
        console.error('Error inserting plans:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importPlans();
