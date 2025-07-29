const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const Pricing = require("../server/models/Pricing");

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const results = [];

fs.createReadStream("./data/pricings.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    try {
      await Pricing.insertMany(results);
      console.log("Pricings imported");
    } catch (err) {
      console.error("Error importing pricings:", err);
    } finally {
      mongoose.disconnect();
    }
  });
