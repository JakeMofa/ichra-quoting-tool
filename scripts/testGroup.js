// scripts/testGroup.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../server/config/db');
const Group = require('../server/models/Group');

async function run() {
  await connectDB();

  try {
    // creates a sample group
    const group = new Group({
      name: "Acme Corp",
      contactName: "Jane Doe",
      contactEmail: "jane.doe@acmecorp.com",
      address: {
        street: "123 Main St",
        city: "Portland",
        state: "OR",
        zip: "97201"
      }
    });

    const saved = await group.save();
    console.log(" Group saved:", saved);

    // read back all groups
    const groups = await Group.find();
    console.log(" All groups in DB:", groups);
  } catch (err) {
    console.error(" Error testing Group model:", err);
  } finally {
    await disconnectDB();
  }
}

run();
