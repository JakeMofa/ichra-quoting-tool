// server/routes/quote.js
const express = require("express");
const router = express.Router();
const quoteController = require("../controllers/quoteController");

// POST → generate + save quotes for all members in the group
// Optional body: { effective_date: "YYYY-MM-DD", tobacco: true|false } to override this batch ru
router.post("/groups/:groupId/quotes", quoteController.generateQuotes);

// POST → one-off preview for a specific member/county 
router.post("/groups/:groupId/quotes/preview", quoteController.previewMemberQuotes);

// GET → latest quotes
router.get("/groups/:groupId/quotes", quoteController.getLatestQuotes);

// GET → full history
router.get("/groups/:groupId/quotes/history", quoteController.getQuoteHistory);

module.exports = router;
