const express = require("express");
const router = express.Router();
const quoteController = require("../controllers/quoteController");

// POST → generate + save quotes
router.post("/groups/:groupId/quotes", quoteController.generateQuotes);

// GET → latest quotes
router.get("/groups/:groupId/quotes", quoteController.getLatestQuotes);

// GET → full history
router.get("/groups/:groupId/quotes/history", quoteController.getQuoteHistory);

module.exports = router;
