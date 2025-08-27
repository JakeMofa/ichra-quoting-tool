// scripts/testIdeon.js
require('dotenv').config();
const {
  createGroup,
  addMember,
  calculateICHRAAffordability // optional, may not be available
} = require('../server/services/ideon');

async function run() {
  try {
    // === Step 1: Create Group ===
    console.log('--- Step 1: Create Group ---');
    const groupPayload = {
      group: {
        chamber_association: true,
        company_name: "Foo Bar, Inc.",
        contact_email: "john@foobar.inc",
        contact_name: "John Doe",
        contact_phone: "212-555-1234",
        external_id: "abc123",
        sic_code: "0700"
      },
      locations: [
        {
          external_id: "def123",
          fips_code: "36081",   // Brooklyn, NY
          name: "Headquarters",
          number_of_employees: 32,
          primary: true,
          zip_code: "11423"
        }
      ]
    };

    const groupRes = await createGroup(groupPayload);
    console.log('Group created:', groupRes.data);

    const groupId = groupRes.data.group.id;
    const locationId = groupRes.data.locations[0].id;

    // === Step 2: Add Member ===
    console.log('--- Step 2: Add Member ---');
    const memberPayload = {
      members: [
        {
          external_id: "mem123",
          first_name: "Alice",
          last_name: "Smith",
          gender: "F",
          date_of_birth: "1985-07-20",
          zip_code: "11423",
          fips_code: "36081",
          location_id: locationId,
          cobra: false,
          retiree: false,
          last_used_tobacco: null,
          dependents: [],
          household_income: 55000,
          household_size: 1,
          safe_harbor_income: 55000
        }
      ]
    };

    const memberRes = await addMember(groupId, memberPayload);
    console.log('Member added:', memberRes.data);

    // === Step 3: Calculate ICHRA Affordability (Optional) ===
    console.log('--- Step 3: Calculate ICHRA Affordability (Optional) ---');
    try {
      const ichraPayload = {
        safe_harbor: "federal_poverty_line",
        contribution: 400,
        rating_area_id: "some-rating-area", // placeholder
        group_id: groupId
      };

      const ichraRes = await calculateICHRAAffordability(groupId, ichraPayload);
      console.log('ICHRA affordability result:', ichraRes.data);
    } catch (err) {
      console.warn('Skipping Step 3: ICHRA affordability not available with this API key.');
    }

    console.log(' Test script finished cleanly.');

  } catch (err) {
    console.error('Error in testIdeon:', err.response?.data || err.message);
  }
}

run();
