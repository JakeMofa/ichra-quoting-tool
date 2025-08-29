// server/controllers/classController.js
const ICHRAClass = require("../models/ICHRAClass");
const Group = require("../models/Group");

// POST /api/groups/:groupId/classes
exports.createClass = async (req, res) => {
  const { groupId } = req.params;
  const payload = req.body;
  console.log(">>> Inside createClass, groupId:", groupId, "payload:", payload);

  try {
    // Step 1: Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      console.warn(">>> Group not found in Mongo:", groupId);
      return res.status(404).json({ error: "Group not found" });
    }

    // Step 2: Create new class
    const classDoc = new ICHRAClass({
      group: groupId,
      name: payload.name,
      description: payload.description || "",
      employee_contribution: payload.employee_contribution,
      dependent_contribution: payload.dependent_contribution,
      subclass: payload.subclass || null,
      members: []
    });

    await classDoc.save();
    console.log(">>> Class saved in Mongo:", classDoc._id);

    // Step 3: Attach to group
    group.classes.push(classDoc._id);
    await group.save();
    console.log(">>> Linked class to group:", group._id);

    return res.status(201).json({
      message: "Class created successfully",
      class: classDoc
    });
  } catch (err) {
    console.error(">>> Error creating class:", err);
    return res.status(500).json({ error: "Failed to create class" });
  }
};

// GET /api/groups/:groupId/classes
exports.getClassesByGroup = async (req, res) => {
  try {
    console.log(">>> Fetching classes for group:", req.params.groupId);
    const classes = await ICHRAClass.find({ group: req.params.groupId }).populate("members");
    console.log(">>> Found classes count:", classes.length);
    res.json(classes);
  } catch (err) {
    console.error(">>> Error fetching classes:", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
};
