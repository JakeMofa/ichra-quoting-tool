// server/index.js
require("dotenv").config({ path: "../.env" });
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Swagger UI
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const openapiPath = path.join(__dirname, "openapi.yaml");
let swaggerDoc = null;
try {
  swaggerDoc = YAML.load(openapiPath);
} catch (e) {
  console.warn("⚠️ openapi.yaml not found or invalid; /api-docs will 404");
}

// Routes
const groupRoutes = require("./routes/groups");
const classRoutes = require("./routes/classes");
const memberRoutes = require("./routes/members");
const ichraRoutes = require("./routes/ichra");
const quoteRoutes = require("./routes/quote");
const summaryRoutes = require("./routes/summary");

// Register models that need to be loaded on startup
require("./models/ICHRAClass");
require("./models/Member");
require("./models/AfforadabilityResult");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;

// Swagger UI route
if (swaggerDoc) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDoc, { explorer: true })
  );
} else {
  app.use("/api-docs", (_req, res) =>
    res.status(404).json({ error: "openapi.yaml missing" })
  );
}

// Mount routes
app.use("/api/groups", groupRoutes); // e.g. /api/groups/:id
app.use("/api/groups", classRoutes); // e.g. /api/groups/:id/classes
app.use("/api/groups/:groupId/members", memberRoutes); // /api/groups/:groupId/members
app.use("/api", ichraRoutes); // e.g. /api/groups/:id/members/:id/ichra
app.use("/api", quoteRoutes); // e.g. /api/groups/:id/quotes
app.use("/api", summaryRoutes);

// Smoke test
app.get("/ping", (req, res) => {
  console.log(">>> /ping called");
  res.json({ message: "pong" });
});

// Connect DB + start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(" MongoDB connected:", MONGO_URI);
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error(" MongoDB connection error:", err.message);
    process.exit(1);
  });