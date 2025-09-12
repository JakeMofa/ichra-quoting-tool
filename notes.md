## APTC Inputs — Calculate MAGI (Step 1)

**POST** `/groups/:groupId/members/:memberId/aptc/magi`

Computes **Modified Adjusted Gross Income (MAGI)** for the *household* for the given tax year.  
You may provide EITHER:
- a **household-level** AGI with add-backs, **or**
- a **member-level** breakdown that the API aggregates to AGI, then applies add-backs.

The endpoint normalizes inputs and returns a consistent MAGI payload that downstream endpoints (Expected Contribution / APTC) can reuse.

---

### Request body (choose exactly one shape)

#### A) Household-level input
```json
{
  "tax_year": 2025,
  "household_size": 3,

  "agi": 65000,

  "add_backs": {
    "nontaxable_social_security": 0,
    "tax_exempt_interest": 0,
    "foreign_earned_income_excluded": 0
  }
}
```

#### B) Member-level input
```json
{
  "tax_year": 2025,
  "household_size": 3,

  "members": [
    {
      "name": "Evan",
      "files_return": true,

      "wages": 60000,
      "self_employment_income": 0,
      "unemployment_comp": 0,
      "alimony_taxable": 0,
      "capital_gains_taxable": 0,
      "other_taxable_income": 0,

      "adjustments": 0
    },
    {
      "name": "Spouse",
      "files_return": true,
      "wages": 5000,
      "adjustments": 0
    }
  ],

  "add_backs": {
    "nontaxable_social_security": 0,
    "tax_exempt_interest": 0,
    "foreign_earned_income_excluded": 0
  }
}
```

**Notes**
- All amounts are **annual dollars** for the given `tax_year`.
- Missing, null, empty-string, or non-numeric values are treated as **0**.
- Intermediate negative subtotals are **clamped to 0** before summation to keep results stable.

---

### Calculation

If you send **household-level**:
```
MAGI = agi
     + add_backs.nontaxable_social_security
     + add_backs.tax_exempt_interest
     + add_backs.foreign_earned_income_excluded
```

If you send **member-level**:
```
AGI = Σ over members (
        wages
      + self_employment_income
      + unemployment_comp
      + alimony_taxable
      + capital_gains_taxable
      + other_taxable_income
      - adjustments
     )  // clamp each member subtotal to >= 0

MAGI = AGI
     + add_backs.nontaxable_social_security
     + add_backs.tax_exempt_interest
     + add_backs.foreign_earned_income_excluded
```

---

### Response (normalized)
```json
{
  "tax_year": 2025,
  "household_size": 3,

  "agi": 65000,
  "add_backs": {
    "nontaxable_social_security": 0,
    "tax_exempt_interest": 0,
    "foreign_earned_income_excluded": 0
  },

  "magi": 65000,
  "magi_rounded": 65000
}
```

- `magi` is the precise sum (can include cents if inputs had them).
- `magi_rounded` is **rounded to the nearest whole dollar** for display/reporting.
- If the request used member-level inputs, the response also echoes a compact `members_summary`:
```json
{
  "members_summary": [
    { "name": "Evan",   "agi_component": 60000 },
    { "name": "Spouse", "agi_component": 5000 }
  ]
}
```

---

### Example cURL

**Household-level**
```bash
curl -s -X POST "$BASE/groups/$GROUP_ID/members/$MEMBER_ID/aptc/magi" \
  -H "$HDR" -d '{
    "tax_year": 2025,
    "household_size": 3,
    "agi": 65000,
    "add_backs": {
      "nontaxable_social_security": 0,
      "tax_exempt_interest": 0,
      "foreign_earned_income_excluded": 0
    }
  }' | jq .
```

**Member-level**
```bash
curl -s -X POST "$BASE/groups/$GROUP_ID/members/$MEMBER_ID/aptc/magi" \
  -H "$HDR" -d '{
    "tax_year": 2025,
    "household_size": 3,
    "members": [
      { "name": "Evan", "files_return": true, "wages": 60000, "adjustments": 0 },
      { "name": "Spouse", "files_return": true, "wages": 5000, "adjustments": 0 }
    ],
    "add_backs": {
      "nontaxable_social_security": 0,
      "tax_exempt_interest": 0,
      "foreign_earned_income_excluded": 0
    }
  }' | jq .
```

---

## Server Implementation (fix)

The previous helper expected `foreign_earned_income` (without “_excluded”) and didn’t support member-level aggregation.  
Use this updated utility and keep the **field names consistent with the docs**.

```js
// server/lib/magi.js
function toNumber(v, def = 0) {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function clampNonNeg(n) {
  return n < 0 ? 0 : n;
}

/**
 * Compute household MAGI from either:
 *  A) { agi, add_backs: { nontaxable_social_security, tax_exempt_interest, foreign_earned_income_excluded } }
 *  B) { members: [...], add_backs: {...} }  // members aggregated to AGI
 *
 * Returns a normalized object:
 *  { agi, add_backs: {...}, magi, magi_rounded, members_summary? }
 */
function computeMAGI(input = {}) {
  const add = input.add_backs || {};
  const add_nss = toNumber(add.nontaxable_social_security);
  const add_te  = toNumber(add.tax_exempt_interest);
  const add_fei = toNumber(add.foreign_earned_income_excluded);

  let agi;

  if (Array.isArray(input.members)) {
    // Member-level aggregation → AGI
    const members_summary = [];
    agi = input.members.reduce((sum, m) => {
      const wages = toNumber(m.wages);
      const se    = toNumber(m.self_employment_income);
      const uc    = toNumber(m.unemployment_comp);
      const ali   = toNumber(m.alimony_taxable);
      const cg    = toNumber(m.capital_gains_taxable);
      const oth   = toNumber(m.other_taxable_income);
      const adj   = toNumber(m.adjustments);
      const per   = clampNonNeg(wages + se + uc + ali + cg + oth - adj);
      members_summary.push({ name: m.name || null, agi_component: Math.round(per) });
      return sum + per;
    }, 0);

    const magi = agi + add_nss + add_te + add_fei;
    return {
      tax_year: toNumber(input.tax_year) || undefined,
      household_size: toNumber(input.household_size) || undefined,

      agi,
      add_backs: {
        nontaxable_social_security: add_nss,
        tax_exempt_interest: add_te,
        foreign_earned_income_excluded: add_fei
      },

      members_summary,
      magi,
      magi_rounded: Math.round(magi)
    };
  }

  // Household-level AGI path
  agi = toNumber(input.agi);

  const magi = agi + add_nss + add_te + add_fei;
  return {
    tax_year: toNumber(input.tax_year) || undefined,
    household_size: toNumber(input.household_size) || undefined,

    agi,
    add_backs: {
      nontaxable_social_security: add_nss,
      tax_exempt_interest: add_te,
      foreign_earned_income_excluded: add_fei
    },

    magi,
    magi_rounded: Math.round(magi)
  };
}

module.exports = { computeMAGI };
```

**Backward compatibility tip**  
If older clients send `foreign_earned_income` (without `_excluded`), you can map it before calling `computeMAGI`:
```js
if (req.body?.add_backs?.foreign_earned_income != null && req.body?.add_backs?.foreign_earned_income_excluded == null) {
  req.body.add_backs.foreign_earned_income_excluded = req.body.add_backs.foreign_earned_income;
  delete req.body.add_backs.foreign_earned_income;
}
```

**Why this fixes things**
- The docs and code now agree on `foreign_earned_income_excluded`.
- Member-level inputs are supported and robust (defaults, clamping).
- The response is normalized (always returns `agi`, `add_backs`, `magi`, `magi_rounded`, and `members_summary` when applicable).