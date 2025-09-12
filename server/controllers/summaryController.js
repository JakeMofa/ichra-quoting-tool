// server/controllers/summaryController.js
const Group = require("../models/Group");
const Member = require("../models/Member");
const QuoteResult = require("../models/QuoteResult");

/* ------------------------------ Utilities ------------------------------ */
function toNum(v) {
  return Number(v) || 0;
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
// normalize query/body value to array (supports "a", ["a"], "a,b")
function toArray(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x.filter(Boolean);
  if (typeof x === "string") return x.split(",").map((s) => s.trim()).filter(Boolean);
  return [x];
}
function parseBool(x) {
  if (typeof x === "boolean") return x;
  if (x == null || x === "") return null;
  const s = String(x).toLowerCase();
  if (s === "any") return null; 
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return null;
}

/* ---------------- Employer Comparison summary (monthly + annual) --------------- */
exports.employerSummary = async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId).populate("classes").lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = await Member.find({ group: groupId })
      .select({
        ichra_class: 1,
        old_employer_contribution: 1,
        first_name: 1,
        last_name: 1,
      })
      .lean();

    // Old employer monthly total
    const oldMonthlyTotal = members.reduce(
      (sum, m) => sum + (Number(m.old_employer_contribution) || 0),
      0
    );

    // Map classId -> monthly employer contribution (prefer monthly_employer_contribution, else employee_contribution)
    const classMap = new Map();
    for (const c of group.classes || []) {
      const monthly = Number(
        c.monthly_employer_contribution ?? c.employee_contribution ?? 0
      );
      classMap.set(String(c._id), { raw: c, monthly });
    }

    // New ICHRA monthly total by assigned class
    let newMonthlyTotal = 0;
    const byClass = {};

    for (const m of members) {
      const classId = m.ichra_class ? String(m.ichra_class) : null;
      if (!classId || !classMap.has(classId)) continue;

      const entry = classMap.get(classId);
      const amount = entry.monthly || 0;
      newMonthlyTotal += amount;

      if (!byClass[classId]) {
        byClass[classId] = {
          name: entry.raw?.name || null,
          members: 0,
          monthlyTotal: 0,
        };
      }
      byClass[classId].members += 1;
      byClass[classId].monthlyTotal += amount;
    }

    // Annualize + deltas
    const oldAnnualTotal = oldMonthlyTotal * 12;
    const newAnnualTotal = newMonthlyTotal * 12;

    const monthlySavings = oldMonthlyTotal - newMonthlyTotal;
    const annualSavings = oldAnnualTotal - newAnnualTotal;

    return res.json({
      group: { _id: group._id, company_name: group.company_name },
      counts: {
        members: members.length,
        classes: (group.classes || []).length,
        members_with_class: Object.values(byClass).reduce((n, x) => n + x.members, 0),
      },
      employer_comparison: {
        old: { monthly_total: round2(oldMonthlyTotal), annual_total: round2(oldAnnualTotal) },
        ichra: { monthly_total: round2(newMonthlyTotal), annual_total: round2(newAnnualTotal) },
        savings: { monthly: round2(monthlySavings), annual: round2(annualSavings) },
      },
      breakdown_by_class: Object.fromEntries(
        Object.entries(byClass).map(([id, v]) => [
          id,
          {
            name: v.name,
            members: v.members,
            monthly_total: round2(v.monthlyTotal),
            annual_total: round2(v.monthlyTotal * 12),
          },
        ])
      ),
    });
  } catch (err) {
    console.error(">>> employerSummary error:", err);
    return res.status(500).json({ error: "Failed to compute employer comparison" });
  }
};

/* ----------------------- Employee Comparison summary -------------------------- */
/**
 * GET  /api/groups/:groupId/summary/employees?carrier=Providence&level=silver,gold&on_market=true
 * POST /api/groups/:groupId/summary/employees
 * Body (optional):
 * {
 *   "selected": { "<memberId>": "<planId>", ... },
 *   "filters": { "carrier": "Providence", "level": ["silver","gold"], "on_market": true }
 * }
 */
exports.employeeSummary = async (req, res) => {
  const { groupId } = req.params;
  const debugEnabled = req.query.debug === "1" || req.body?.debug === true;

  // Accept filters from querystring and body; body wins if provided
  const queryFilters = {
    carrier: toArray(req.query.carrier),
    level: toArray(req.query.level),
    on_market: parseBool(req.query.on_market),
  };
  const body = req.body || {};
  const bodyFiltersRaw = body.filters || {};
  const bodyFilters = {
    carrier: toArray(bodyFiltersRaw.carrier),
    level: toArray(bodyFiltersRaw.level),
    on_market:
      typeof bodyFiltersRaw.on_market === "boolean"
        ? bodyFiltersRaw.on_market
        : parseBool(bodyFiltersRaw.on_market),
  };
  const selected = body.selected || {};

  // merge query + body, with body taking precedence
  const filters = {
    carrier: bodyFilters.carrier.length ? bodyFilters.carrier : queryFilters.carrier,
    level: bodyFilters.level.length ? bodyFilters.level : queryFilters.level,
    on_market:
      bodyFilters.on_market !== null && bodyFilters.on_market !== undefined
        ? bodyFilters.on_market
        : queryFilters.on_market,
  };

  try {
    const group = await Group.findById(groupId).populate("classes").lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = await Member.find({ group: groupId })
      .select({ first_name: 1, last_name: 1, ichra_class: 1, old_employee_contribution: 1 })
      .lean();

    // classId -> monthly employee allowance
    const classAllowance = new Map();
    for (const c of group.classes || []) {
      const monthly = Number(c.employee_contribution) || 0;
      classAllowance.set(String(c._id), { name: c.name, monthly });
    }

    // latest quotes batch
    const latest = await QuoteResult.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .lean();

    // index quotes: memberId -> array of quotes
    const quotesByMember = new Map();
    if (latest && Array.isArray(latest.quotes)) {
      for (const row of latest.quotes) {
        const mid = String(row.member);
        const quotes = Array.isArray(row.quotes) ? row.quotes : [];
        quotesByMember.set(
          mid,
          quotes.map((q) => ({
            plan_id: q.plan_id,
            adjusted_cost:
              Number(q.adjusted_cost) ??
              Number(q.net_premium) ??
              Number(q.premium) ??
              0,
            plan_details: q.plan_details || {},
          }))
        );
      }
    }

    // filter predicate with multi-select support
    function passFilters(q) {
      const d = q.plan_details || {};
      // carrier (multi)x
      if (filters.carrier && filters.carrier.length) {
        const carrier = String(d.carrier_name || "").toLowerCase();
        const allowed = filters.carrier.map((x) => String(x).toLowerCase());
        if (!allowed.includes(carrier)) return false;
      }
      // level (multi)
      if (filters.level && filters.level.length) {
        const lvl = String(d.level || "").toLowerCase();
        const allowed = filters.level.map((x) => String(x).toLowerCase());
        if (!allowed.includes(lvl)) return false;
      }
      // on_market (bool)
      if (typeof filters.on_market === "boolean") {
        if ((d.on_market ?? null) !== filters.on_market) return false;
      }
      return true;
    }

    // compute rows
    const rows = [];
    let totals = { old_monthly: 0, new_monthly: 0, monthly_savings: 0 };

    for (const m of members) {
      const mid = String(m._id);
      const oldOOP = toNum(m.old_employee_contribution);

      const allowance =
        m.ichra_class && classAllowance.has(String(m.ichra_class))
          ? classAllowance.get(String(m.ichra_class)).monthly
          : 0;

      const allQuotes = quotesByMember.get(mid) || [];

      // chosen plan: explicit selection first
      let chosen = null;
      const selPlanId = selected[mid];
      if (selPlanId) {
        chosen = allQuotes.find((q) => q.plan_id === selPlanId) || null;
      }
      // else pick cheapest that passes filters; if none pass, fallback to cheapest overall
      if (!chosen) {
        const filtered = allQuotes.filter(passFilters);
        const pool = filtered.length ? filtered : allQuotes;
        chosen =
          pool.slice().sort((a, b) => (a.adjusted_cost || 0) - (b.adjusted_cost || 0))[0] ||
          null;
      }

      const planPremium = chosen ? toNum(chosen.adjusted_cost) : 0; // net after subsidy already
      const newOOP = Math.max(0, planPremium - allowance);
      const monthlySavings = oldOOP - newOOP;

      totals.old_monthly += oldOOP;
      totals.new_monthly += newOOP;
      totals.monthly_savings += monthlySavings;
      
      const debugEnabled = req.query.debug === "1" || req.body?.debug === true;
      const filtered = allQuotes.filter(passFilters);
      const pool = filtered.length ? filtered : allQuotes;
      const chosenBy =
        selPlanId && chosen ? "selected" :
        (filtered.length ? "cheapest_filtered" : "cheapest_overall");
      
      const debugInfo = debugEnabled ? {
        plans_total: allQuotes.length,
        plans_passing_filters: filtered.length,
        chosen_by: chosenBy,
        chosen_adjusted_cost: chosen ? round2(chosen.adjusted_cost) : null,
        allowance_used: round2(allowance)
      } : undefined;      

      rows.push({
        member_id: mid,
        name: `${m.first_name || ""} ${m.last_name || ""}`.trim(),
        selected_plan_id: chosen ? chosen.plan_id : null,
        selected_plan: chosen
          ? {
              carrier_name: chosen.plan_details?.carrier_name || null,
              display_name:
                chosen.plan_details?.display_name || chosen.plan_details?.name || null,
              level: chosen.plan_details?.level || null,
              on_market: chosen.plan_details?.on_market ?? null,
            }
          : null,
        allowance_monthly: round2(allowance),
        old_out_of_pocket_monthly: round2(oldOOP),
        new_out_of_pocket_monthly: round2(newOOP),
        monthly_savings: round2(monthlySavings),
        annual_savings: round2(monthlySavings * 12),
        debug: debugInfo ?? null

      });
    }

    return res.json({
      group: { _id: group._id, company_name: group.company_name },
      filters_applied: {
        carrier: filters.carrier && filters.carrier.length ? filters.carrier : null,
        level: filters.level && filters.level.length ? filters.level : null,
        on_market:
          typeof filters.on_market === "boolean" ? filters.on_market : null,
      },
      employees: rows,
      totals: {
        old_out_of_pocket_monthly: round2(totals.old_monthly),
        new_out_of_pocket_monthly: round2(totals.new_monthly),
        monthly_savings: round2(totals.monthly_savings),
        old_out_of_pocket_annual: round2(totals.old_monthly * 12),
        new_out_of_pocket_annual: round2(totals.new_monthly * 12),
        annual_savings: round2(totals.monthly_savings * 12),
      },
    });
  } catch (err) {
    console.error(">>> employeeSummary error:", err);
    return res.status(500).json({ error: "Failed to compute employee comparison" });
  }
};

/* -------------------- Filter options for UI controls --------------------- */
/**
 * GET /api/groups/:groupId/summary/employees/filters
 * Returns unique carriers, levels, and market flags based on the latest quotes.
 */
exports.employeeFilterOptions = async (req, res) => {
  const { groupId } = req.params;

  try {
    const latest = await QuoteResult.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .lean();

    const carriers = new Set();
    const levels = new Set();
    const market = new Set(); // true/false presence

    if (latest && Array.isArray(latest.quotes)) {
      for (const row of latest.quotes) {
        for (const q of row.quotes || []) {
          const d = q.plan_details || {};
          if (d.carrier_name) carriers.add(d.carrier_name);
          if (d.level) levels.add(String(d.level).toLowerCase());
          if (typeof d.on_market === "boolean") market.add(d.on_market);
        }
      }
    }

    return res.json({
      carriers: Array.from(carriers).sort(),
      levels: Array.from(levels).sort(),
      market: Array.from(market).sort(), // e.g., [false, true]
    });
  } catch (err) {
    console.error(">>> employeeFilterOptions error:", err);
    return res.status(500).json({ error: "Failed to load filter options" });
  }
};