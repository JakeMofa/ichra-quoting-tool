# ICHRA Quoting Tool API Documentation

Base URL: `http://localhost:5050/api`

---

## Health
**GET** `/ping`  
→ `{ "message": "pong" }`

---

## Groups
**POST** `/groups`  
Create a new employer group.  
Body:  
```json
{ "company_name": "Acme Inc", "contact_name": "Ava Admin", "contact_email": "ava@acme.com" }
```

**GET** `/groups/:groupId`  
Fetch group details.

---

## Classes
**POST** `/groups/:groupId/classes`  
Create a new ICHRA class (e.g., full-time, part-time).  
Body:  
```json
{ "name": "Full-Time", "employee_contribution": 400, "dependent_contribution": 200 }
```

**GET** `/groups/:groupId/classes`  
List classes for a group.

**PATCH** `/groups/:groupId/classes/:classId`  
Update a class contribution.  
Body (example):  
```json
{ "employee_contribution": 350 }
```

---

## Members
**POST** `/groups/:groupId/members`  
Add a new member to a group.  
Body:  
```json
{ "first_name": "Evan", "last_name": "Kim", "date_of_birth": "1991-06-20", "gender": "M", "zip_code": "97222", "ichra_class": "<classId>" }
```

**GET** `/groups/:groupId/members`  
List members of a group.

**PATCH** `/groups/:groupId/members/:memberId`  
Update a member (zip, income, contributions, class, etc).  
Body (example):  
```json
{ "old_employer_contribution": 350, "old_employee_contribution": 100, "agi": 38000, "household_size": 3 }
```

---

## ICHRA Affordability
**POST** `/groups/:groupId/members/:memberId/ichra`  
Calculate affordability (calls Ideon → fallback mock). Saves result in Mongo.

**GET** `/groups/:groupId/members/:memberId/ichra`  
Fetch latest affordability result.

**GET** `/groups/:groupId/members/:memberId/ichra/history`  
Fetch full affordability history.

---

## Quotes
**POST** `/groups/:groupId/quotes`  
Generate quotes for all members. Saves batch in Mongo.  
- If a ZIP maps to multiple counties → response includes `meta.county_ids` and `skipped=true`.  
- If one county → full quotes returned.  
Body:  
```json
{ "effective_date": "2025-01-01", "tobacco": false }
```

**POST** `/groups/:groupId/quotes/preview`  
Generate quotes for a specific member & county (used after multi-county ZIP case).  
Body:  
```json
{ "member_id": "<memberId>", "county_id": "41005", "effective_date": "2025-01-01", "tobacco": false }
```

**GET** `/groups/:groupId/quotes`  
Fetch latest quotes batch (trimmed shape).

**GET** `/groups/:groupId/quotes/history`  
Fetch full quote history (all batches).

---

## Benchmark (SLCSP) — Find the second-lowest Silver premium

**POST** `/groups/:groupId/quotes/benchmark`  
Returns the benchmark (SLCSP) for a specific member, scoped by county, age (from DOB), and tobacco flag.

### Request Body
```json
{
  "member_id": "string (Member _id, required)",
  "county_id": "string (FIPS-like county id, required)",
  "effective_date": "YYYY-MM-DD (optional, defaults today)",
  "tobacco": false
}
```

---

## Employer Summary
**GET** `/groups/:groupId/summary/employer`  
Returns total employer costs under the old plan vs new ICHRA plan, and monthly/annual savings.

---

## Employee Summary
**GET** `/groups/:groupId/summary/employees`  
**POST** `/groups/:groupId/summary/employees`  

Returns per-employee comparison:
- Old out-of-pocket cost  
- New out-of-pocket cost (after ICHRA allowance)  
- Potential monthly and annual savings  

Optional POST body supports filters and explicit plan selections:  
```json
{
  "selected": { "<memberId>": "<planId>" },
  "filters": { "carrier": "Providence", "level": "silver", "on_market": true }
}
```

---
---

## Employee Filters (facets for interactive filtering)
**GET** `/groups/:groupId/summary/employees/filters`  
Returns available facet values drawn from the latest quotes for the group.

**Response Example**
```json
{
  "carriers": [
    "BridgeSpan Health Company",
    "Kaiser Permanente",
    "Moda Health",
    "PacificSource Health Plans",
    "Providence Health Plan",
    "Regence BlueCross BlueShield"
  ],
  "levels": ["bronze", "expanded_bronze", "gold", "silver"],
  "market": [true, false]
}

## Data Imports (CSV → Mongo)
Run scripts from `/scripts` to load reference data:  
- `importPlans.js`  
- `importPricings.js`  
- `importPlanCounties.js`  
- `importZipCounties.js`  
- `importCounties.js`  

Each clears and repopulates the respective collection.