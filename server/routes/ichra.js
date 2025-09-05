// server/routes/ichra.js
const express = require("express");
const router = express.Router();
const ichraController = require("../controllers/ichraController");

// Calculate affordability and save result
router.post("/groups/:groupId/members/:memberId/ichra", ichraController.calculateICHRA);

// Latest (two aliases: with and without `/latest`)
router.get("/groups/:groupId/members/:memberId/ichra/latest", ichraController.getLatestICHRA);
router.get("/groups/:groupId/members/:memberId/ichra", ichraController.getLatestICHRA);

// Full history
router.get("/groups/:groupId/members/:memberId/ichra/history", ichraController.getICHRAHistory);

module.exports = router;
