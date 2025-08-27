

const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

const Plan = require("../server/models/plan");

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Connect to MongoDB
async function importPlans() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected – starting plans import");

    // Prepare to collect valid plan records
    const results = [];
    let loggedSample = false;

    // Stream and parse the CSV file
    fs.createReadStream(path.resolve(__dirname, "../data/plans.csv"))
      .pipe(csv({
        // Strip BOM and trim whitespace from each header
        mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, "")
      }))
      .on("data", (data) => {
        // On first row only, log detected columns and sample data
        if (!loggedSample) {
          console.log("Detected columns:", Object.keys(data));
          console.log("First row sample:", data);
          loggedSample = true;
        }

        // Only import rows where CSV's `id` column is nonempty
        if (data.id && data.id.trim() !== "") {
          results.push({
            plan_id:        data.id.trim(),              // CSV `id` → DB `plan_id`
            carrier_name:   data.carrier_name?.trim()   || null,
            display_name:   data.display_name?.trim()   || null,
            effective_date: data.effective_date 
                              ? new Date(data.effective_date) 
                              : null,
            expiration_date: data.expiration_date 
                              ? new Date(data.expiration_date) 
                              : null,
            name:           data.name?.trim()           || null,
            plan_type:      data.plan_type?.trim()      || null,
            service_area_id:data.service_area_id?.trim()|| null,
            source:         data.source?.trim()         || null,
            type:           data.type?.trim()           || null,
            plan_market:    data.plan_market?.trim()    || null,
            on_market:      String(data.on_market).toLowerCase() === "true",
            off_market:     String(data.off_market).toLowerCase() === "true",
            metal_level:    data.metal_level?.trim()    || null,
            issuer_id:      data.hios_issuer_id?.trim() || null,
          });
        }
      })
      .on("end", async () => {
        // After parsing completes, insert into MongoDB
        if (results.length === 0) {
          console.warn("No valid plans found to import.");
        } else {
          await Plan.insertMany(results);
          console.log(`Imported ${results.length} plans successfully.`);
        }
        await mongoose.disconnect();
      })
      .on("error", async (err) => {
        // Handle file read errors
        console.error("File read error:", err);
        await mongoose.disconnect();
      });

  } catch (err) {
    // Handle connection errors
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

importPlans();
