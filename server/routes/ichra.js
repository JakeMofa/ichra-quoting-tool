// server/routes/ichra.js
const express = require("express");
const router = express.Router();
const ichraController = require("../controllers/ichraController");


// POST /api/groups/:groupId/members/:memberId/ichra
// Calculate affordability and save result
router.post("/groups/:groupId/members/:memberId/ichra", ichraController.calculateICHRA);

// GET /api/groups/:groupId/members/:memberId/ichra
// Fetch saved affordability results for a member
router.get("/groups/:groupId/members/:memberId/ichra", ichraController.getLatestICHRA);



// GET full history

router.get("/groups/:groupId/members/:memberId/ichra/history", ichraController.getICHRAHistory);


module.exports = router;

