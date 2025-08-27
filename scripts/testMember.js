// scripts/testMember.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../server/config/db');
const Member = require('../server/models/Member');
const Group = require('../server/models/Group');
const ICHRAClass = require('../server/models/ICHRAClass');

async function runTest() {
  await connectDB();

  try {
    // Get an existing group and class from the database
    const group = await Group.findOne();
    const ichraClass = await ICHRAClass.findOne();

    if (!group || !ichraClass) {
      console.error("No Group or ICHRAClass found. Please create them first.");
      return;
    }

    // Create a new Member document
    const member = new Member({
      group: group._id,                // Link to Group
      ichra_class: ichraClass._id,     // Link to ICHRA Class

      first_name: "Alice",
      last_name: "Smith",
      date_of_birth: new Date("1985-07-20"), // New field name (was `dob`)
      gender: "F",
      tobacco_user: false,

      zip_code: "11423",               // New field name (was `zip`)
      fips_code: "36081",              // Added field (needed for Ideon)
      state: "NY",

      dependents: [
        {
          first_name: "Bob",
          last_name: "Smith",
          date_of_birth: new Date("2010-05-12"), // New field name
          gender: "M",
          tobacco_user: false,
          relationship: "child"
        }
      ],

      ideon_member_id: "dummy456"      // Placeholder until real API ID
    });

    // Save to DB
    await member.save();
    console.log("Member created:", member);

    // Query back with population for reference
    const members = await Member.find()
      .populate("group")
      .populate("ichra_class");
    console.log("All members:", members);

  } catch (err) {
    console.error("Error in testMember.js:", err);
  } finally {
    await disconnectDB();
  }
}

runTest();
