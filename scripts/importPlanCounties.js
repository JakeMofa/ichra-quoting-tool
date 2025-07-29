const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const PlanCounty = require("../server/models/PlanCounty");

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const results = [];

fs.createReadStream("./data/plan_counties.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    try {
      await PlanCounty.insertMany(results);
      console.log("Plan counties imported");
    } catch (err) {
      console.error("Error importing plan counties:", err);
    } finally {
      mongoose.disconnect();
    }
  });
