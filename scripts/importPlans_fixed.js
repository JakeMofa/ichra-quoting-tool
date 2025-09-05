require('dotenv').config();

// scripts/importPlans.js
// Usage: node scripts/importPlans.js ./data/plans.csv

const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const mongoose = require("mongoose");
require("dotenv").config();

const Plan = require("../server/models/plan.js"); // align with importPlans.js
const { connectDB, disconnectDB } = require("../server/config/db");

const CSV_FILE = process.argv[2] || path.join(__dirname, "plans.csv");

(async () => {
  await connectDB();
  console.log("Mongo connected");

  const rows = [];
  let count = 0, upserts = 0;

  const toBool = (v) => {
    if (typeof v === "boolean") return v;
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (["true","t","yes","y","1"].includes(s)) return true;
    if (["false","f","no","n","0"].includes(s)) return false;
    return undefined;
  };

  const levelMap = (v) => (v ? String(v).trim().toLowerCase() : v);

  const stream = fs.createReadStream(CSV_FILE).pipe(csv.parse({ headers: true, ignoreEmpty: true, trim: true }));

  for await (const r of stream) {
    count++;

    const doc = {
      // import plan_id EXACTLY as in CSV (including any "-NN" suffix)
      plan_id: r.plan_id && String(r.plan_id).trim(),

      carrier_name: r.carrier_name,
      display_name: r.display_name,
      name: r.name,
      plan_type: r.plan_type,
      service_area_id: r.service_area_id,
      source: r.source,
      type: r.type,

      level: levelMap(r.level),
      on_market: toBool(r.on_market),
      off_market: toBool(r.off_market),

      network_name: r.network_name,
      summary_of_benefits_url: r.summary_of_benefits_url,

      // keep other fields only if you have them in your CSV; unknowns will be ignored by Mongoose
      effective_date: r.effective_date ? new Date(r.effective_date) : undefined,
      expiration_date: r.expiration_date ? new Date(r.expiration_date) : undefined,
    };

    if (!doc.plan_id) {
      console.warn(`[skip] row ${count} has no plan_id`);
      continue;
    }

    // upsert by plan_id
    const res = await Plan.updateOne({ plan_id: doc.plan_id }, { $set: doc }, { upsert: true });
    if (res.upsertedCount || res.modifiedCount) upserts++;
    if (count % 1000 === 0) console.log(`...processed ${count}`);
  }

  console.log(`Done. read rows=${count}, upserts/updates=${upserts}`);
  await disconnectDB();
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
