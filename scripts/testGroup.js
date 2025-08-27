// scripts/testGroup.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../server/config/db');
const Group = require('../server/models/Group');

async function runTest() {
  await connectDB();

  try {
    const group = new Group({
      company_name: "Test Employer Inc.",  // ✅ FIXED
      ein: "12-3456789",
      contact_name: "Jane Doe",
      contact_email: "jane.doe@testemployer.com",
      contact_phone: "555-555-5555",
      address: {
        line1: "123 Main St",
        city: "New York",
        state: "NY",
        zip: "10001",
      },
      ideon_group_id: "dummy123"
    });

    await group.save();
    console.log(" Group created:", group);

    const groups = await Group.find();
    console.log("All groups:", groups);

  } catch (err) {
    console.error(" Error in testGroup.js:", err);
  } finally {
    await disconnectDB();
  }
}

runTest();
