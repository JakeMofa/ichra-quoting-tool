// server/controllers/classController.js
const mongoose = require("mongoose");
const ICHRAClass = require("../models/ICHRAClass");
const Group = require("../models/Group");
const Member = require("../models/Member");

/**
 * POST /api/groups/:groupId/classes
 *Create one class (optionally as a subclass via parent_class)
 */
exports.createClass = async (req, res) => {
  const { groupId } = req.params;
  const {
    name,
    description = "",
    employee_contribution,
    dependent_contribution,
    parent_class = null, // optional: ObjectId of parent class (for age band etc.)
    subclass = null,    // optional: label e.g. "Age 30–39"
    is_default = false, // used by the seed endpoint
  } = req.body || {};

  console.log(">>> Inside createClass, groupId:", groupId, "payload:", req.body);

  try {
    // 1) Validate group
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // 2) If parent_class provided, verify it belongs to the same group
    if (parent_class) {
      if (!mongoose.Types.ObjectId.isValid(parent_class)) {
        return res.status(400).json({ error: "Invalid parent_class id" });
      }
      const parent = await ICHRAClass.findOne({ _id: parent_class, group: groupId });
      if (!parent) {
        return res.status(400).json({ error: "parent_class does not belong to this group" });
      }
    }

    // 3) Create class
    const classDoc = new ICHRAClass({
      group: groupId,
      name,
      description,
      employee_contribution,
      dependent_contribution,
      parent_class: parent_class || null,
      subclass: subclass || null,
      is_default: !!is_default,
      members: [],
    });

    await classDoc.save();
    console.log(">>> Class saved in Mongo:", classDoc._id);

    // 4) Attach to group.classes
    group.classes = group.classes || [];
    group.classes.push(classDoc._id);
    await group.save();
    console.log(">>> Linked class to group:", group._id);

    return res.status(201).json({
      message: "Class created successfully",
      class: classDoc,
    });
  } catch (err) {
    console.error(">>> Error creating class:", err);
    return res.status(500).json({ error: "Failed to create class" });
  }
};

/**
 * GET /api/groups/:groupId/classes
 * List classes for a group (parent + subclasses)
 */
exports.getClassesByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    console.log(">>> Fetching classes for group:", groupId);

    const classes = await ICHRAClass.find({ group: groupId })
      .populate("members")
      .sort({ createdAt: -1 });

    console.log(">>> Found classes count:", classes.length);
    return res.json(classes);
  } catch (err) {
    console.error(">>> Error fetching classes:", err);
    return res.status(500).json({ error: "Failed to fetch classes" });
  }
};

/**
 * PATCH /api/groups/:groupId/classes/:classId
 * Edit a class
 */
exports.updateClass = async (req, res) => {
  try {
    const { groupId, classId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ error: "Invalid classId" });
    }

    const klass = await ICHRAClass.findOne({ _id: classId, group: groupId });
    if (!klass) return res.status(404).json({ error: "Class not found in this group" });

    const allowed = [
      "name",
      "description",
      "employee_contribution",
      "dependent_contribution",
      "parent_class",
      "subclass",
      "is_default",
    ];

    // If parent_class is changing, validate belongs to this group (or allow null)
    if (req.body.parent_class !== undefined) {
      const pc = req.body.parent_class;
      if (pc) {
        if (!mongoose.Types.ObjectId.isValid(pc)) {
          return res.status(400).json({ error: "Invalid parent_class id" });
        }
        const parent = await ICHRAClass.findOne({ _id: pc, group: groupId });
        if (!parent) {
          return res.status(400).json({ error: "parent_class does not belong to this group" });
        }
      }
    }

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) klass[k] = req.body[k];
    });

    await klass.save();
    return res.json({ message: "Class updated successfully", class: klass });
  } catch (err) {
    console.error(">>> Error updating class:", err);
    return res.status(500).json({ error: "Failed to update class" });
  }
};

/**
 * DELETE /api/groups/:groupId/classes/:classId
 * Delete a class
 * - Detaches members pointing to this class (sets ichra_class = null)
 * - Removes class from group.classes
 * - Also deletes subclasses where parent_class === classId (optional; here we **keep** them but clear their parent if desired)
 */
exports.deleteClass = async (req, res) => {
  try {
    const { groupId, classId } = req.params;

    const klass = await ICHRAClass.findOne({ _id: classId, group: groupId });
    if (!klass) return res.status(404).json({ error: "Class not found in this group" });

    // 1) Null-out members who point to this class
    await Member.updateMany(
      { group: groupId, ichra_class: classId },
      { $set: { ichra_class: null } }
    );

    // 2) Option: If this is a parent class, you can either:
  
    //  keeps subclasses but clear their parent link.
    await ICHRAClass.updateMany(
      { group: groupId, parent_class: classId },
      { $set: { parent_class: null } }
    );

    // 3) Remove from group.classes
    await Group.updateOne(
      { _id: groupId },
      { $pull: { classes: classId } }
    );

    // 4) Delete the class
    await ICHRAClass.deleteOne({ _id: classId, group: groupId });

    return res.json({ message: "Class deleted successfully" });
  } catch (err) {
    console.error(">>> Error deleting class:", err);
    return res.status(500).json({ error: "Failed to delete class" });
  }
};

/**
 * POST /api/groups/:groupId/classes/seed-defaults
 * One-time helper to seed 5 common classes for a group.
 */
exports.seedDefaultClasses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Prevent duplicates per group
    const existing = await ICHRAClass.find({ group: groupId, is_default: true });
    if (existing.length > 0) {
      return res.status(409).json({ error: "Default classes already exist for this group" });
    }

    const defaults = [
      { name: "Full-time employees", employee_contribution: 400, dependent_contribution: 200, is_default: true },
      { name: "Part-time employees", employee_contribution: 300, dependent_contribution: 150, is_default: true },
      { name: "Seasonal employees", employee_contribution: 250, dependent_contribution: 125, is_default: true },
      { name: "Salaried employees", employee_contribution: 450, dependent_contribution: 225, is_default: true },
      { name: "Non-salaried (hourly) employees", employee_contribution: 320, dependent_contribution: 160, is_default: true },
    ];

    const created = await ICHRAClass.insertMany(
      defaults.map((d) => ({ group: groupId, ...d }))
    );

    // push into group.classes list
    await Group.updateOne(
      { _id: groupId },
      { $push: { classes: { $each: created.map((c) => c._id) } } }
    );

    return res.status(201).json({ message: "Defaults seeded", classes: created });
  } catch (err) {
    console.error(">>> Error seeding default classes:", err);
    return res.status(500).json({ error: "Failed to seed default classes" });
  }
};



/**
 * GET /api/groups/:groupId/classes/tree
 * Returns classes arranged as a tree (parents with nested children[]).
 * - Includes member_count for quick UI badges.
 * - Keeps "orphan" subclasses (whose parent was deleted) at the root no to lose them.
 */
exports.getClassesTree = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Pull all classes for the group
    const all = await ICHRAClass.find({ group: groupId })
      .select("_id group name description employee_contribution dependent_contribution parent_class subclass is_default members createdAt updatedAt")
      .lean();

    // Prepare a map for quick parent lookups and give each class a children array
    const byId = new Map();
    all.forEach((c) => {
      c.member_count = Array.isArray(c.members) ? c.members.length : 0;
      c.children = [];
      byId.set(String(c._id), c);
    });

    // Build the tree
    const roots = [];
    all.forEach((c) => {
      if (c.parent_class) {
        const parent = byId.get(String(c.parent_class));
        if (parent) {
          parent.children.push(c);
        } else {
          // parent missing -> keep visible at root to  fix it in UI
          roots.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    // Optional: sort roots/children by name for nice UX
    const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "");
    const sortTree = (nodes) => {
      nodes.sort(sortByName);
      nodes.forEach((n) => sortTree(n.children));
    };
    sortTree(roots);

    return res.json(roots);
  } catch (err) {
    console.error(">>> Error building class tree:", err);
    return res.status(500).json({ error: "Failed to build class tree" });
  }
};
