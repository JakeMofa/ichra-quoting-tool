// server/routes/summary.js
const express = require("express");
const router = express.Router();

const {
  employerSummary,
  employeeSummary,
  employeeFilterOptions,
} = require("../controllers/summaryController");

// Employer totals (old vs ICHRA)
router.get("/groups/:groupId/summary/employer", employerSummary);

// Employee comparison with interactive filters
// Accept both GET (query params) and POST (body with {selected, filters})
router.get("/groups/:groupId/summary/employees", employeeSummary);
router.post("/groups/:groupId/summary/employees", employeeSummary);

// Filter option lists for UI (carriers, levels, market flags)
router.get("/groups/:groupId/summary/employees/filters", employeeFilterOptions);

module.exports = router;