// server/scripts/createIndexes.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Use shared DB connection helpers
const { connectDB, disconnectDB } = require("../server/config/db");

// Register models (all with ../server/models/… paths)
const ZipCounty  = require("../server/models/ZipCounties");
const County     = require("../server/models/Counties");
const PlanCounty = require("../server/models/PlanCounties");
const Pricing    = require("../server/models/Pricing");
const Plan       = require("../server/models/Plan");

const MONGO_URI = process.env.MONGO_URI; // from .env

if (!MONGO_URI) {
  console.error(" MONGO_URI is not defined. Did you load the right .env?");
  process.exit(1);
}

(async () => {
  try {
    await connectDB();
    console.log(" Connected:", MONGO_URI);

    // Run syncIndexes sequentially
    const steps = [
      ["ZipCounties", ZipCounty],
      ["Counties", County],
      ["PlanCounties", PlanCounty],
      ["Pricing", Pricing],
      ["Plan", Plan],
    ];

    for (const [name, Model] of steps) {
      console.log(`→ Syncing indexes for ${name}...`);
      await Model.syncIndexes();
      console.log(`   ✓ ${name} indexes synced`);
    }

    console.log(" Indexes synced successfully.");
    await disconnectDB();
    process.exit(0);
  } catch (e) {
    console.error(" Failed to create indexes:", e);
    try { await disconnectDB(); } catch {}
    process.exit(1);
  }
})();
