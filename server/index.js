// server/index.js
require("dotenv").config({ path: "../.env" }); 
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const groupRoutes = require("./routes/groups"); // Groups routes

// models that need to be registered are required
require("./models/ICHRAClass");   // 

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;

// Mount routes
app.use("/api/groups", groupRoutes);

//  smoke test route here
app.get("/ping", (req, res) => {
  console.log(">>> /ping called");
  res.json({ message: "pong" });
});

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected:", MONGO_URI);
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1); // exit process if DB connection fails
  });
