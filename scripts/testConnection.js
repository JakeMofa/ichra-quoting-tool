const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "ichra",                // force DB name
      serverSelectionTimeoutMS: 5000, // fail fast if no DB
    });

    console.log(" Connected with Mongoose");
    console.log("State:", mongoose.connection.readyState); // 1 means connected

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(" Collections:", collections.map(c => c.name));

    await mongoose.disconnect();
    console.log(" Disconnected");
  } catch (err) {
    console.error(" Connection failed:", err);
  }
}

run();
