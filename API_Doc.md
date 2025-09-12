# ICHRA Quoting Tool — API Documentation

Base URL: `http://localhost:5050/api`  
All JSON requests must set: `Content-Type: application/json`

You can export these helpers to make the cURL snippets copy-paste ready:

```bash
BASE="http://localhost:5050/api"
HDR="Content-Type: application/json"
```

---

## Health

### `GET /ping`
Health probe.

**Response**
```json
{ "message": "pong" }
```

---

## Groups

### `POST /groups`
Create a new employer group.

**Body**
```json
{
  "company_name": "Acme Inc (Run-007)",
  "contact_name": "Ava Admin",
  "contact_email": "ava+run007@acme.com"
}
```

**cURL**
```bash
NEW_GROUP_JSON=$(curl -s -X POST "$BASE/groups" -H "$HDR" -d '{
  "company_name":"Acme Inc (Run-007)",
  "contact_name":"Ava Admin",
  "contact_email":"ava+run007@acme.com"
}')
echo "$NEW_GROUP_JSON" | jq .
GROUP_ID=$(echo "$NEW_GROUP_JSON" | jq -r '.group._id // ._id')
echo "GROUP_ID=$GROUP_ID"
```

### `GET /groups`
List groups (for pickers / admin).

### `GET /groups/:groupId`
Fetch a single group.

**Notes**
- All endpoints that take `:groupId` validate ObjectId and return **400** if invalid, **404** if unknown.

---

## Classes (Base + Optional Sub-classes)

Represents ICHRA classes (e.g., “Full-time”, “Part-time”) and optional sub-classes (e.g., “Age 30–39”) that can carry different allowance amounts.

### `POST /groups/:groupId/classes`
Create a class or sub-class.

**Create base class**
```json
{
  "name": "Full-time",
  "employee_contribution": 450,
  "dependent_contribution": 100
}
```

**Create sub-class (under a base class)**
```json
{
  "name": "Full-time",
  "subclass": "Age 30–39",
  "parent_class": "<BASE_CLASS_ID>",
  "employee_contribution": 475,
  "dependent_contribution": 80
}
```

### `GET /groups/:groupId/classes`
List classes for a group.

### `PATCH /groups/:groupId/classes/:classId`
Update a class.
```json
{ "employee_contribution": 350 }
```

### `DELETE /groups/:groupId/classes/:classId`
Delete a class (fails if in use).

**Quick cURL to create two common classes**
```bash
# ensure Full-time exists
CLS_FULL=$(curl -s "$BASE/groups/$GROUP_ID/classes" | jq -r '.[] | select(.name=="Full-time") | ._id')
if [ -z "$CLS_FULL" ] || [ "$CLS_FULL" = "null" ]; then
  CLS_FULL=$(curl -s -X POST "$BASE/groups/$GROUP_ID/classes" -H "$HDR" -d '{
    "name":"Full-time","employee_contribution":450,"dependent_contribution":100,"monthly_employer_contribution":450
  }' | jq -r '.class._id // ._id // .result._id')
fi
echo "CLS_FULL=$CLS_FULL"

# ensure Part-time exists
CLS_PART=$(curl -s "$BASE/groups/$GROUP_ID/classes" | jq -r '.[] | select(.name=="Part-time") | ._id')
if [ -z "$CLS_PART" ] || [ "$CLS_PART" = "null" ]; then
  CLS_PART=$(curl -s -X POST "$BASE/groups/$GROUP_ID/classes" -H "$HDR" -d '{
    "name":"Part-time","employee_contribution":300,"dependent_contribution":50,"monthly_employer_contribution":300
  }' | jq -r '.class._id // ._id // .result._id')
fi
echo "CLS_PART=$CLS_PART"

# sanity
curl -s "$BASE/groups/$GROUP_ID/classes" | jq 'map({name,_id,employee_contribution,dependent_contribution})'
```

---

## Members (with Optional Dependents)

### `POST /groups/:groupId/members`
Create a member (dependents optional).

```json
{
  "first_name": "Alice",
  "last_name": "Lopez",
  "dob": "1990-02-15",
  "gender": "F",
  "zip_code": "97222",

  "ichra_class": "<CLASS_OR_SUBCLASS_ID>",
  "external_id": "ext-alice-run007",

  "household_size": 3,
  "household_income": 38000,
  "safe_harbor_income": 38000,
  "agi": 38000,
  "tax_year": 2025,

  "old_employer_contribution": 350,
  "old_employee_contribution": 120,

  "dependents": []
}
```

### `GET /groups/:groupId/members`
List members for a group.

### `GET /groups/:groupId/members/:memberId`
Get one member.

### `PATCH /groups/:groupId/members/:memberId`
Partial update. You may replace `dependents` (entire array), update `ichra_class`, income, location, etc.

```json
{
  "old_employer_contribution": 350,
  "old_employee_contribution": 100,
  "agi": 38000,
  "household_size": 3
}
```

### Dependents — item-level updates
- `PATCH /groups/:groupId/members/:memberId/dependents/:dependentId`
- `DELETE /groups/:groupId/members/:memberId/dependents/:dependentId`

### `DELETE /groups/:groupId/members/:memberId`
Delete a member (dependents are embedded and removed with the member).

**Create two members (example)**
```bash
# Alice (Full-time)
M1_JSON=$(curl -s -X POST "$BASE/groups/$GROUP_ID/members" -H "$HDR" -d "{
  \"first_name\":\"Alice\",\"last_name\":\"Lopez\",\"dob\":\"1990-02-15\",\"gender\":\"F\",
  \"zip_code\":\"97222\",
  \"household_size\":3, \"household_income\":38000, \"safe_harbor_income\":38000,
  \"agi\":38000, \"tax_year\":2025,
  \"old_employer_contribution\":350, \"old_employee_contribution\":120,
  \"ichra_class\":\"$CLS_FULL\",
  \"external_id\":\"ext-alice-run007\"
}")
echo "$M1_JSON" | jq .
M1=$(echo "$M1_JSON" | jq -r '.member._id // ._id'); echo "M1=$M1"

# Ben (Part-time)
M2_JSON=$(curl -s -X POST "$BASE/groups/$GROUP_ID/members" -H "$HDR" -d "{
  \"first_name\":\"Ben\",\"last_name\":\"Ng\",\"dob\":\"1987-06-20\",\"gender\":\"M\",
  \"zip_code\":\"97222\",
  \"household_size\":2, \"household_income\":30000, \"safe_harbor_income\":30000,
  \"agi\":30000, \"tax_year\":2025,
  \"old_employer_contribution\":200, \"old_employee_contribution\":150,
  \"ichra_class\":\"$CLS_PART\",
  \"external_id\":\"ext-ben-run007\"
}")
echo "$M2_JSON" | jq .
M2=$(echo "$M2_JSON" | jq -r '.member._id // ._id'); echo "M2=$M2"

# quick view
curl -s "$BASE/groups/$GROUP_ID/members" \
| jq 'map({name:(.first_name+" "+.last_name), _id,
           old_emp:.old_employer_contribution, old_ee:.old_employee_contribution})'
```

---

## ICHRA Affordability

Persists the result per member (latest + history).

### `POST /groups/:groupId/members/:memberId/ichra`
Calculate affordability (Ideon-backed; stored in Mongo).

**Body**
```json
{
  "effective_date": "2025-01-01",
  "rating_area_location": "work"
}
```

**Response (fields of interest)**
```json
{
  "result": {
    "minimum_employer_contribution": 543.16,
    "fpl_minimum_employer_contribution": 628.47,
    "premium_tax_credit": 443.29,
    "benchmark_plan_id": "25303NY0630001",
    "benchmark_premium": 828.79,
    "affordable": true
  }
}
```

**cURL**
```bash
# Alice
curl -s -X POST "$BASE/groups/$GROUP_ID/members/$M1/ichra" -H "$HDR" \
  -d '{"effective_date":"2025-01-01","rating_area_location":"work"}' \
| jq '.result | {minimum_employer_contribution, fpl_minimum_employer_contribution, premium_tax_credit, benchmark_plan_id, benchmark_premium, affordable}'

# Ben
curl -s -X POST "$BASE/groups/$GROUP_ID/members/$M2/ichra" -H "$HDR" \
  -d '{"effective_date":"2025-01-01","rating_area_location":"work"}' \
| jq '.result | {minimum_employer_contribution, fpl_minimum_employer_contribution, premium_tax_credit, benchmark_plan_id, benchmark_premium, affordable}'
```

### `GET /groups/:groupId/members/:memberId/ichra`
Get latest affordability result.

### `GET /groups/:groupId/members/:memberId/ichra/history`
Get full affordability history.

---

## Quotes (Batch + Benchmark)

### `POST /groups/:groupId/quotes`
Generate quotes for **all** members. Saves a batch, and returns a summary.  
If a ZIP maps to multiple counties, the response may include `skipped=true` with `meta.county_ids` hints.

**Body**
```json
{
  "effective_date": "2025-01-01",
  "tobacco": false,
  "rating_area_location": "work"
}
```

**cURL**
```bash
curl -s -X POST "$BASE/groups/$GROUP_ID/quotes" -H "$HDR" -d '{
  "effective_date":"2025-01-01",
  "tobacco": false,
  "rating_area_location": "work"
}' | jq '.message'
```

**Inspect one member**
```bash
# Alice
curl -s "$BASE/groups/$GROUP_ID/quotes" \
| jq --arg M1 "$M1" '
  .quotes[] | select(.member._id==$M1)
  | {member, affordability,
     first_plan:(.quotes[0] | {plan_id, premium, adjusted_cost,
                               benchmark_plan_id, benchmark_premium})}
'

# Ben
curl -s "$BASE/groups/$GROUP_ID/quotes" \
| jq --arg M2 "$M2" '
  .quotes[] | select(.member._id==$M2)
  | {member, affordability,
     first_plan:(.quotes[0] | {plan_id, premium, adjusted_cost,
                               benchmark_plan_id, benchmark_premium})}
'
```

### `GET /groups/:groupId/quotes`
Fetch latest quotes batch (trimmed shape).

### `GET /groups/:groupId/quotes/history`
Fetch all historical batches.

### `POST /groups/:groupId/quotes/preview`
Preview quotes for a **specific** member + county (used after multi-county ZIP).

**Body**
```json
{
  "member_id": "<memberId>",
  "county_id": "41005",
  "effective_date": "2025-01-01",
  "tobacco": false
}
```

### `POST /groups/:groupId/quotes/benchmark`
Return the benchmark SLCSP for a member (county, age from DOB, tobacco).

**Body**
```json
{
  "member_id": "<memberId>",
  "county_id": "41005",
  "effective_date": "2025-01-01",
  "tobacco": false
}
```

**Notes**
- For UI/UX: when `POST /quotes` runs long, fire-and-poll:
  1) `POST /quotes` (don’t block the UI),
  2) Poll `GET /quotes` until `plans` are present,
  3) Show progress text during polling.

---

## Employer Summary

### `GET /groups/:groupId/summary/employer`
Totals for old plan vs ICHRA plan (monthly/annual) plus class breakdown.

**cURL**
```bash
curl -s "$BASE/groups/$GROUP_ID/summary/employer" | jq .
```

**Response (shape)**
```json
{
  "group": { "_id": "…", "company_name": "Acme Inc (Run-007)" },
  "counts": { "members": 2, "classes": 2, "members_with_class": 2 },
  "employer_comparison": {
    "old": { "monthly_total": 550, "annual_total": 6600 },
    "ichra": { "monthly_total": 750, "annual_total": 9000 },
    "savings": { "monthly": -200, "annual": -2400 }
  },
  "breakdown_by_class": {
    "68c3…0fa": { "name":"Full-time","members":1,"monthly_total":450,"annual_total":5400 },
    "68c3…100": { "name":"Part-time","members":1,"monthly_total":300,"annual_total":3600 }
  }
}
```

---

## Employee Summary (+ Filters & Selections)

### `GET /groups/:groupId/summary/employees`
Returns per-employee rows (selected plan, allowance, OOP old/new, savings).

**Filtering via querystring**
- `carrier=Providence`
- `level=silver`
- `on_market=true|false`

**cURL**
```bash
# All
curl -s "$BASE/groups/$GROUP_ID/summary/employees" | jq '.employees'

# Silver, on-market only
curl -s "$BASE/groups/$GROUP_ID/summary/employees?level=silver&on_market=true" | jq '.employees'
```

### `POST /groups/:groupId/summary/employees`
Same as GET, but also accepts explicit selections and filters in body.

**Body**
```json
{
  "selected": { "<memberId>": "<planId>" },
  "filters": { "carrier": "Providence", "level": "silver", "on_market": true }
}
```

### `GET /groups/:groupId/summary/employees/filters`
Facet values present in the latest quotes for the group.

**Response**
```json
{
  "carriers": ["BridgeSpan Health Company","Kaiser Permanente","Moda Health","PacificSource Health Plans","Providence Health Plan","Regence BlueCross BlueShield"],
  "levels": ["bronze","expanded_bronze","gold","silver"],
  "market": [true, false]
}
```

---

## Members & Dependents — CRUD Recipes

**List members**
```bash
curl -s "$BASE/groups/$GROUP_ID/members" \
| jq 'map({id: ._id, name: (.first_name+" "+.last_name), dependents_count: (.dependents // [] | length)})'
```

**Get one member**
```bash
curl -s "$BASE/groups/$GROUP_ID/members/$MEMBER_ID" -H "Accept: application/json" \
| jq '{_id, first_name, last_name, ichra_class, dependents}'
```

**Create with dependents (optional)**
```bash
curl -s -X POST "$BASE/groups/$GROUP_ID/members" -H "$HDR" \
-d '{
  "first_name":"Alice","last_name":"Lopez","dob":"1985-05-10","gender":"F",
  "zip_code":"30301","ichra_class":"<classId-optional>",
  "dependents":[
    {"first_name":"Sam","last_name":"Lopez","dob":"2016-06-01","gender":"M","relationship":"child","same_household":true},
    {"first_name":"Alex","last_name":"Lopez","dob":"2019-11-12","gender":"F","relationship":"child","same_household":true}
  ]
}' \
| jq '{message, member:(.member | { _id, first_name, last_name, dependents })}'
```

**Update identity**
```bash
curl -s -X PATCH "$BASE/groups/$GROUP_ID/members/$MEMBER_ID" \
  -H "$HDR" -H "Accept: application/json" \
  -d '{"first_name":"Parker","last_name":"Smithson"}' \
| jq '{message, member:(.member | { _id, first_name, last_name })}'
```

**Replace entire dependents array**
```bash
curl -s -X PATCH "$BASE/groups/$GROUP_ID/members/$MEMBER_ID" -H "$HDR" \
-d '{
  "dependents": [
    {"first_name":"Nico","last_name":"Smithson","dob":"2016-05-10","gender":"U","relationship":"child","same_household":true},
    {"first_name":"Rae","last_name":"Smithson","dob":"2012-01-15","gender":"F","relationship":"child","same_household":true}
  ]
}' | jq '{message, dependents_count:(.member.dependents|length)}'
```

**Edit a single dependent**
```bash
# get an ID
DEP_ID=$(curl -s "$BASE/groups/$GROUP_ID/members/$MEMBER_ID" -H "Accept: application/json" \
  | jq -r '.dependents[0]._id')

# patch that dependent
curl -s -X PATCH "$BASE/groups/$GROUP_ID/members/$MEMBER_ID/dependents/$DEP_ID" \
  -H "$HDR" -H "Accept: application/json" \
  -d '{"relationship":"other","dob":"2014-09-09"}' \
| jq '{message, dependent:(.dependent | { _id, first_name, relationship, dob })}'
```

**Delete a single dependent**
```bash
curl -s -X DELETE "$BASE/groups/$GROUP_ID/members/$MEMBER_ID/dependents/$DEP_ID" \
  -H "Accept: application/json" | jq .
```

**Delete a member**
```bash
# example: find an id by name
DEL_ID=$(curl -s "$BASE/groups/$GROUP_ID/members" \
  | jq -r '.[] | select(.first_name=="Jake" and .last_name=="Mofa") | ._id' | head -n1)

curl -s -X DELETE "$BASE/groups/$GROUP_ID/members/$DEL_ID" \
  -H "Accept: application/json" | jq .
```

**Notes & gotchas**
- `dependents` on `PATCH /members/:id` **replaces** the whole array. Use the per-dependent endpoints to modify one in place.
- When changing `ichra_class`, the member is removed from the old class and added to the new one automatically.

---

## Group Deletion — Shallow vs Cascade (with Dry-Run)

### `DELETE /groups/:groupId`
Query params:
- `mode=shallow|cascade` (default: `shallow`)
- `dry_run=true|false` (default: `false`)

**Dry-run preview (no deletion)**
```json
{
  "message": "Dry run only — nothing deleted.",
  "mode": "cascade",
  "impact": {
    "group": { "_id": "…", "name": "Acme Inc (Run-004)" },
    "will_delete": {
      "members": 2,
      "classes": 2,
      "affordability_results": 2,
      "dependents": "embedded within members (auto-removed)"
    }
  }
}
```

**Actual cascade**
```json
{
  "message": "Group and all related data deleted.",
  "deleted": { "group_id": "…", "members": 2, "classes": 2, "affordability_results": 2 }
}
```

**Shallow delete with children present**
- Returns **409** with a hint to use cascade and includes an `impact` preview.

**cURL recipes**
```bash
GID_="$GROUP_ID"

# 1) Preview only
curl -s -X DELETE "$BASE/groups/$GID_?mode=cascade&dry_run=true" -H "Accept: application/json" | jq .

# 2) Do it
curl -s -X DELETE "$BASE/groups/$GID_?mode=cascade" -H "Accept: application/json" | jq .

# 3) Verify
curl -s "$BASE/groups" | jq 'map({id: ._id, name: .company_name})'
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/groups/$GID_"   # -> 404
```

---

## Benchmarks / Examples — End-to-End

1) **Create group** → 2) **Create classes** → 3) **Create members**  
4) **Run affordability** → 5) **Generate quotes** → 6) **Summaries**

All the cURL under each section above can be executed in order using the exported `BASE`, `HDR`, `GROUP_ID`, `CLS_*`, `M1`, `M2` variables.

---

## Status Codes & Errors

- `400` — invalid ObjectId, missing/invalid fields, illegal state transitions  
- `404` — not found (group, class, member, batch)  
- `409` — conflict (e.g., shallow delete with related data present)  
- `429` — upstream rate limits (Ideon) — retry logic exists server-side  
- `5xx` — server errors (logged; check backend logs)

---

## Notes for Frontend Integrations

- **Invalid Group IDs**: client should block navigation when `/groups/:id` lookup returns 404; show a friendly “Group not found” inline error.  
- **Quotes UX**: fire `POST /quotes`, then poll `GET /quotes` (with backoff) and display progress to avoid request timeouts.  
- **Summary Filters**: use `/summary/employees/filters` to build chips; apply querystring (GET) or JSON (POST) filters.

---
```