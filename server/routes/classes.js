// server/routes/classes.js
const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");

// Create new class
router.post("/:groupId/classes", classController.createClass);

// Get all classes for a group
router.get("/:groupId/classes", classController.getClassesByGroup);

module.exports = router;
