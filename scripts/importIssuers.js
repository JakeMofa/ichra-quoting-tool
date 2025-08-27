const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const { connectDB, disconnectDB } = require('../server/config/db');
const Issuer = require('../server/models/Issuer');

async function importIssuers() {
  await connectDB();

  // resolve CSV file path
  const filePath = path.join(__dirname, '..', 'data', 'issuers.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    await disconnectDB();
    process.exit(1);
  }

  const issuers = [];

  // read and parse the CSV
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // only include rows with required fields
      if (row.id && row.name) {
        issuers.push({
          issuer_id: row.id.trim(),                     // from CSV "id"
          name: row.name.trim(),                        // from CSV "name"
          alternate_name: row.alternate_name?.trim() || null, // from CSV "alternate_name"
          logo_path: row.logo_path?.trim() || null      // from CSV "logo_path"
        });
      }
    })
    .on('end', async () => {
      if (issuers.length === 0) {
        console.warn('No issuers parsed from CSV.');
        await disconnectDB();
        return process.exit(1);
      }

      try {
        // clear old data, then insert fresh issuers
        await Issuer.deleteMany({});
        await Issuer.insertMany(issuers, { ordered: false });
        console.log(`Imported ${issuers.length} issuers`);
      } catch (err) {
        console.error('Error inserting issuers:', err);
      } finally {
        await disconnectDB();
      }
    })
    .on('error', async (err) => {
      console.error('Error reading CSV file:', err);
      await disconnectDB();
    });
}

importIssuers();
