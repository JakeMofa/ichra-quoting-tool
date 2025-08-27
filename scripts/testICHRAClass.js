// scripts/testICHRAClass.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../server/config/db');

const Group = require('../server/models/Group');
const ICHRAClass = require('../server/models/ICHRAClass');

async function runTest() {
  await connectDB();

  try {
    // Find an existing group
    const group = await Group.findOne();
    if (!group) {
      console.error('No group found. Please create a group first.');
      await disconnectDB();
      return process.exit(1);
    }

    // Create a test ICHRA Class
    const ichraClass = new ICHRAClass({
      group: group._id,
      name: "Full-time Employees",
      description: "Employees working 30+ hours per week",
      employee_contribution: 300,    // $300 employer contribution for employee
      dependent_contribution: 150,   // $150 employer contribution for dependents
      subclass: "Under 30"
    });

    await ichraClass.save();
    console.log('ICHRA Class created:', ichraClass);

    // Verify back from DB
    const classes = await ICHRAClass.find({ group: group._id });
    console.log('All ICHRA Classes for group:', classes);

  } catch (err) {
    console.error('Error in testICHRAClass.js:', err);
  } finally {
    await disconnectDB();
  }
}

runTest();
