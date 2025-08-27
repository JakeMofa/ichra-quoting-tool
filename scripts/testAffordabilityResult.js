// scripts/testAffordabilityResult.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../server/config/db');
const AffordabilityResult = require('../server/models/AfforadabilityResult');
const Group = require('../server/models/Group');
const Member = require('../server/models/Member');

async function run() {
  await connectDB();

  try {
    // Create a dummy group (or fetch an existing one)
    const group = await Group.findOne() || await new Group({
      name: 'Test Group',
      contactName: 'John Doe',
      contactEmail: 'john.doe@test.com',
      address: { street: '123 Main St', city: 'Dallas', state: 'TX', zip: '75201' }
    }).save();

    // Create a dummy member (or fetch an existing one)
    const member = await Member.findOne() || await new Member({
      first_name: 'Alice',
      last_name: 'Smith',
      dob: new Date('1990-05-15'),
      zip: '75201',
      state: 'TX',
      ichra_class: null // if needed, link to an ICHRAClass _id later
    }).save();

    // Create affordability result tied to the above
    const result = new AffordabilityResult({
      member: member._id,
      group: group._id,
      fpl_percent: 250,
      expected_contribution: 120,
      benchmark_plan_id: 'PLAN123',
      benchmark_premium: 450,
      premium_tax_credit: 200,
      affordable: true,
      raw_response: {
        message: 'Sample response from Ideon',
        benchmark_plan_id: 'PLAN123',
        premium: 450
      }
    });

    const saved = await result.save();
    console.log('AffordabilityResult saved:', saved);

    const results = await AffordabilityResult.find().populate('member').populate('group');
    console.log('All AffordabilityResults in DB:', results);

  } catch (err) {
    console.error('Error testing AffordabilityResult model:', err);
  } finally {
    await disconnectDB();
    console.log('Disconnected from MongoDB');
  }
}

run();
