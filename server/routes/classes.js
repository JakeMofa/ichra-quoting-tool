// server/routes/classes.js
const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");

// CREATE
// Create new class
router.post("/:groupId/classes", classController.createClass);

// Get all classes for a group
// LIST (flat)
router.get("/:groupId/classes", classController.getClassesByGroup);

// LIST (tree)  
// GET /api/groups/:groupId/classes/tree
router.get("/:groupId/classes/tree", classController.getClassesTree);

// UPDATE (edit)
// PATCH /api/groups/:groupId/classes/:classId
router.patch("/:groupId/classes/:classId", classController.updateClass);

// DELETE
// DELETE /api/groups/:groupId/classes/:classId
router.delete("/:groupId/classes/:classId", classController.deleteClass);

// SEED defaults (one-time helper)
// POST /api/groups/:groupId/classes/seed-default
router.post("/:groupId/classes/seed-defaults", classController.seedDefaultClasses);

module.exports = router;





