// server/routes/members.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const memberController = require("../controllers/memberController");

// create + list
router.post("/", memberController.createMember);
router.get("/", memberController.getMembersByGroup);

// read one
router.get("/:memberId", memberController.getMemberById);
// just incase
router.get("/groups/:groupId/members/:memberId", memberController.getMemberById);

// update member (class, contributions, MAGI, dependents array replace, etc.)
router.patch("/:memberId", memberController.updateMember);

//  delete member
router.delete("/:memberId", memberController.deleteMember);

//  per-dependent edit/delete
router.patch("/:memberId/dependents/:dependentId", memberController.updateDependent);
router.delete("/:memberId/dependents/:dependentId", memberController.deleteDependent);

module.exports = router;
