## APTC Inputs — Calculate MAGI (Step 1)

**POST** `/groups/:groupId/members/:memberId/aptc/magi`

Computes **Modified Adjusted Gross Income (MAGI)** for the *household* for the plan year.  
You can provide either:
- a single household AGI, **or**
- per-person incomes that the API will aggregate into AGI.

The endpoint returns a **normalized MAGI breakdown** we will reuse for Expected Contribution (Step 2) and APTC.

### Request Body (one of the two shapes)

#### A) Household-level input

```json ``
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


#### B) member-level input

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


Calculation

If you send household AGI:

MAGI = agi
     + add_backs.nontaxable_social_security
     + add_backs.tax_exempt_interest
     + add_backs.foreign_earned_income_excluded


If you send member-level:

AGI = Σ over members (
        wages
      + self_employment_income
      + unemployment_comp
      + alimony_taxable
      + capital_gains_taxable
      + other_taxable_income
      - adjustments
     )

MAGI = AGI
     + add_backs.nontaxable_social_security
     + add_backs.tax_exempt_interest
     + add_backs.foreign_earned_income_excluded


All amounts are annual dollars for the chosen tax_year.

Negative intermediate values are clamped at 0 for stability when summing.

We round to the nearest whole dollar in the response (store exact cents if you prefer).

magi math
// server/lib/magi.js
function toNumber(v, def = 0) {
  if (v == null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function computeMAGI({ agi = 0, nontaxable_social_security = 0, tax_exempt_interest = 0, foreign_earned_income = 0 } = {}) {
  return (
    toNumber(agi) +
    toNumber(nontaxable_social_security) +
    toNumber(tax_exempt_interest) +
    toNumber(foreign_earned_income)
  );
}
module.exports = { computeMAGI };