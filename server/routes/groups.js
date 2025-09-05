// server/routes/groups.js
const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");

// POST /api/groups - create group
router.post("/", groupController.createGroup);

// GET /api/groups - list all groups
router.get("/", groupController.listGroups);

// GET /api/groups/:groupId - fetch one group
router.get("/:groupId", groupController.getGroupById);

// Nested routes
const memberRoutes = require("./members");
router.use("/:groupId/members", memberRoutes);

module.exports = router;
