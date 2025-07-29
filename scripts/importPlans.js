// importing all of the data
const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const Plan = require("../server/models/plan");

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const results = [];

fs.createReadStream("./data/plans.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    try {
      await Plan.insertMany(results);
      console.log("Plans imported");
    } catch (err) {
      console.error("Error importing plans:", err);
    } finally {
      mongoose.disconnect();
    }
  });
