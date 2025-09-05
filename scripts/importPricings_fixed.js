// scripts/importPricings.js
// Usage: node scripts/importPricings.js ./data/pricings.csv

const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
require("dotenv").config();

const { connectDB, disconnectDB } = require("../server/config/db");
const Pricing = require("../server/models/Pricing.js");

const CSV_FILE = process.argv[2] || path.join(__dirname, "pricings.csv");

(async () => {
  await connectDB();
  console.log("Mongo connected");

  let count = 0, inserted = 0, bulk = [];

  const toBool = (v) => {
    if (typeof v === "boolean") return v;
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    if (["true","t","yes","y","1"].includes(s)) return true;
    if (["false","f","no","n","0"].includes(s)) return false;
    return false;
  };

  const toNum = (v) => (v === "" || v == null ? null : Number(v));

  const stream = fs.createReadStream(CSV_FILE).pipe(csv.parse({ headers: true, ignoreEmpty: true, trim: true }));

  for await (const r of stream) {
    count++;

    // IMPORTANT: plan_id must match plans.csv exactly (including any -NN suffix)
    const plan_id = r.plan_id && String(r.plan_id).trim();
    if (!plan_id) {
      console.warn(`[skip] row ${count} has no plan_id`);
      continue;
    }

    const row = {
      plan_id,
      rating_area_id: r.rating_area_id && String(r.rating_area_id).trim(),
      age: toNum(r.age),
      tobacco: toBool(r.tobacco),   // your CSV should have a tobacco flag column
      premium: toNum(r.premium),
    };

    if (row.age == null || row.premium == null) {
      // Occasionally CSVs separate tobacco/non-tobacco premiums; adapt here if needed.
      console.warn(`[skip] bad numeric fields on row ${count} plan_id=${plan_id} age=${row.age} premium=${row.premium}`);
      continue;
    }

    bulk.push({ insertOne: { document: row } });
    if (bulk.length >= 5000) {
      const res = await Pricing.bulkWrite(bulk, { ordered: false });
      inserted += (res.insertedCount || 0);
      bulk = [];
      console.log(`...inserted so far ${inserted} (processed ${count})`);
    }
  }

  if (bulk.length) {
    const res = await Pricing.bulkWrite(bulk, { ordered: false });
    inserted += (res.insertedCount || 0);
  }

  console.log(`Done. processed=${count}, inserted=${inserted}`);
  await disconnectDB();
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
