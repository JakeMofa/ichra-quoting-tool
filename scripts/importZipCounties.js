const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const ZipCounty = require("../server/models/ZipCounty");

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const results = [];

fs.createReadStream("./data/zip_counties.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    try {
      await ZipCounty.insertMany(results);
      console.log("Zip counties imported");
    } catch (err) {
      console.error("Error importing zip counties:", err);
    } finally {
      mongoose.disconnect();
    }
  });
