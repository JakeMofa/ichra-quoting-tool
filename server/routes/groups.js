const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");

// POST /api/groups - create group
router.post("/", groupController.createGroup);

// GET /api/groups - fetch all groups
router.get("/", (req, res, next) => groupController.getGroups(req, res, next));

// GET /api/groups/:id - fetch single group
router.get("/:id", (req, res, next) => groupController.getGroupById(req, res, next));

// Nested routes
const memberRoutes = require("./members");
router.use("/:groupId/members", memberRoutes);

module.exports = router;
