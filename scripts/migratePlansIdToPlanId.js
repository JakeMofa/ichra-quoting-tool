// scripts/migratePlansIdToPlanId.js
const mongoose = require("mongoose");
require("dotenv").config();
const { connectDB, disconnectDB } = require("../server/config/db");
const Plan = require("../server/models/plan");

async function migratePlans() {
  await connectDB();
  console.log(">>> Starting migration: id → plan_id ...");

  // Only look at docs that have a non-empty id
  const docs = await Plan.find({ id: { $ne: null } });
  console.log(`Found ${docs.length} plans with old 'id' field.`);

  for (const doc of docs) {
    try {
      await Plan.updateOne(
        { _id: doc._id },
        {
          $set: { plan_id: doc.id },
          $unset: { id: "" }, // remove the old id field
        }
      );
    } catch (err) {
      console.error(`Failed to migrate doc ${doc._id}:`, err.message);
    }
  }

  console.log(">>> Migration finished.");
  await disconnectDB();
}

migratePlans();
