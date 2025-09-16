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
const authRoutes = require("./routes/auth"); 

// Register models that need to be loaded on startup
require("./models/ICHRAClass");
require("./models/Member");
require("./models/AfforadabilityResult");

const app = express();
app.use(express.json());

// ---- CORS (explicit origin + custom headers) ----
const ALLOWED =
  process.env.ALLOWED_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) || [
    "http://localhost:3000",
  ];

const corsOptions = {
  origin: ALLOWED,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Mock-Mode",
    "X-Ideon-Key",
  ],
};
app.use(cors(corsOptions));
app.options(/^\/.*$/, cors(corsOptions));

// ---- Per-request context (mock + ideonKey) ----
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    const rawMock = req.get("X-Mock-Mode");
    const mock =
      rawMock === "1" ||
      rawMock === "true" ||
      rawMock === "on" ||
      rawMock === "yes";
    const ideonKeyHeader = req.get("X-Ideon-Key");
    const ideonKey =
      ideonKeyHeader && ideonKeyHeader.trim() ? ideonKeyHeader.trim() : undefined;

    req.ctx = { mock, ideonKey };

    // lightweight header log to verify flow
    console.log("[hdr]", req.method, req.path, {
      mock: mock ? "1" : undefined,
      key: ideonKey ? "present" : undefined,
    });
  }
  next();
});

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;
console.log(">>> Using MONGO_URI:", MONGO_URI);

// Swagger UI route
if (swaggerDoc) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc, { explorer: true }));
} else {
  app.use("/api-docs", (_req, res) => res.status(404).json({ error: "openapi.yaml missing" }));
}

// Mount routes
app.use("/api/groups", groupRoutes);                    // /api/groups/:id
app.use("/api/groups", classRoutes);                    // /api/groups/:id/classes
app.use("/api/groups/:groupId/members", memberRoutes);  // /api/groups/:groupId/members
app.use("/api", ichraRoutes);                           // e.g. /api/groups/:id/members/:id/ichra
app.use("/api", quoteRoutes);                           // e.g. /api/groups/:id/quotes
app.use("/api", summaryRoutes);
app.use("/api/auth", authRoutes);   

// Smoke test under /api
app.get("/api/ping", (_req, res) => {
  console.log(">>> /api/ping called");
  res.json({ message: "pong" });
});

// Connect DB + start server
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // fail fast if can’t connect
    family: 4,                      // force IPv4 instead of IPv6
  })
  .then(() => {
    console.log(" MongoDB connected:", MONGO_URI);
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Swagger docs at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error(" MongoDB connection error:", err.message);
    process.exit(1);
  });