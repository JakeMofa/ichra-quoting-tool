// server/index.js
require("dotenv").config({ path: "../.env" }); 
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Routes
const groupRoutes = require("./routes/groups"); 
const classRoutes = require("./routes/classes"); 
const memberRoutes = require("./routes/members");   // NEW
const ichraRoutes = require("./routes/ichra"); 
const quoteRoutes = require("./routes/quote");     // NEW

// Register models that need to be loaded on startup
require("./models/ICHRAClass");
require("./models/Member");
require("./models/AfforadabilityResult");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;

// Mount routes
app.use("/api/groups", groupRoutes);   // e.g. /api/groups/:id
app.use("/api/groups", classRoutes);   // e.g. /api/groups/:id/classes
app.use("/api/groups/:groupId/members", memberRoutes);  // /api/groups/:groupId/members
app.use("/api", ichraRoutes);          // e.g. /api/groups/:id/members/:id/ichra
app.use("/api", quoteRoutes);          // e.g. /api/groups/:id/quotes

// Smoke test
app.get("/ping", (req, res) => {
  console.log(">>> /ping called");
  res.json({ message: "pong" });
});

// Connect DB + start server
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
    process.exit(1);
  });
