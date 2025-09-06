// server/routes/members.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const memberController = require("../controllers/memberController");

// POST /api/groups/:groupId/members → add member
router.post("/", memberController.createMember);

// GET /api/groups/:groupId/members → list members
router.get("/", memberController.getMembersByGroup);

// PATCH /api/groups/:groupId/members/:memberId → update class & old contributions
router.patch("/:memberId", memberController.updateMember);

// route
router.get('/groups/:groupId/members/:memberId', memberController.getMemberById);

module.exports = router;
