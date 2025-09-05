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
{ "name": "Full-Time", "contribution_employee": 400, "contribution_dependents": 200 }
```

**GET** `/groups/:groupId/classes`  
List classes for a group.

---

## Members
**POST** `/groups/:groupId/members`  
Add a new member to a group.  
Body:  
```json
{ "first_name": "Evan", "last_name": "Kim", "dob": "1991-06-20", "gender": "M", "zip_code": "97222", "ichra_class": "<classId>" }
```

**GET** `/groups/:groupId/members`  
List members of a group.

**PATCH** `/groups/:groupId/members/:memberId`  
Update a member (zip, income, class, etc).  
Body (example):  
```json
{ "zip_code": "97222", "household_income": 65000, "household_size": 3 }
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

## Data Imports (CSV → Mongo)
Run scripts from `/scripts` to load reference data:  
- `importPlans.js`  
- `importPricings.js`  
- `importPlanCounties.js`  
- `importZipCounties.js`  
- `importCounties.js`  

Each clears and repopulates the respective collection.