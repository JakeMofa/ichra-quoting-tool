// scripts/importPlans_fixed.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");

const { connectDB, disconnectDB } = require("../server/config/db");
const Plan = require("../server/models/plan.js");

// Allow override via CLI; default to ../data/plans.csv
const CSV_FILE = process.argv[2] || path.resolve(__dirname, "..", "data", "plans.csv");

const toBool = (v) => {
  if (typeof v === "boolean") return v;
  if (v == null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(s)) return true;
  if (["false", "f", "no", "n", "0"].includes(s)) return false;
  return undefined;
};

const levelMap = (v) => (v == null ? undefined : String(v).trim().toLowerCase());

(async () => {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`[importPlans] CSV not found: ${CSV_FILE}
Usage: node scripts/importPlans_fixed.js ./data/plans.csv
`);
    process.exit(1);
  }

  await connectDB();
  console.log("Mongo connected");
  let count = 0;
  let upserts = 0;

  const stream = fs
    .createReadStream(CSV_FILE)
    .pipe(csv.parse({ headers: true, ignoreEmpty: true, trim: true }));

  for await (const r of stream) {
    count++;

    // IMPORTANT: The CSV must have a "plan_id" column. If yours uses "id", change here accordingly.
    const pid = (r.plan_id ?? r.id ?? "").toString().trim();
    if (!pid) {
      if (count <= 5) console.warn(`[skip] row ${count}: missing plan_id`);
      continue;
    }

    const doc = {
      plan_id: pid,                            // exact, including suffix like "-04"
      carrier_name: r.carrier_name ?? undefined,
      display_name: r.display_name ?? undefined,
      name: r.name ?? undefined,
      plan_type: r.plan_type ?? undefined,
      service_area_id: r.service_area_id ?? undefined,
      source: r.source ?? undefined,
      type: r.type ?? undefined,

      level: levelMap(r.level),
      on_market: toBool(r.on_market),
      off_market: toBool(r.off_market),

      network_name: r.network_name ?? undefined,
      summary_of_benefits_url: r.summary_of_benefits_url ?? undefined,

      effective_date: r.effective_date ? new Date(r.effective_date) : undefined,
      expiration_date: r.expiration_date ? new Date(r.expiration_date) : undefined,
    };

    // Upsert normalized record
    const res = await Plan.updateOne({ plan_id: pid }, { $set: doc }, { upsert: true });
    if ((res.upsertedCount ?? 0) + (res.modifiedCount ?? 0) > 0) upserts++;
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
