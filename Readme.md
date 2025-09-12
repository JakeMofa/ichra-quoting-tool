# ICHRA Quoting Tool

A full-stack application for running Individual Coverage Health Reimbursement Arrangement (ICHRA) affordability checks, ACA subsidy quotes, and summary comparisons.

---

## Project Structure

```
ichra-quoting-tool/
├── client/           # React frontend
├── server/           # Express + MongoDB API
├── scripts/          # Data import / maintenance scripts
├── data/             # CSVs for carriers, plans, pricing, geography
├── seed.sh           # One-shot DB seeder (canonical order)
├── .env              # (optional) root env; read by seed.sh
├── package.json      # Root meta + workspace helpers
├── Videos    # Videos for Explanation of Code Architecture
└── README.md
```

---

## Environment Setup

Both the backend (`server/`) and frontend (`client/`) come with `.env.example` files.

1. Go to each `.env.example`:
   - `server/.env.example`
   - `client/.env.example`

2. Remove the `.example` from the filename so they become:
   - `server/.env`
   - `client/.env`

3. Fill in your real values (e.g. `IDEON_API_KEY`, `MONGO_URI`, etc.).

Everything should work once the correct values are in place.

---

## For the Code Explanation its in the Video folder with both videos for explanation



## Features

- **ICHRA Affordability**: Calculates minimum employer contributions and FPL-based thresholds.  
- **ACA Subsidies**: Applies Premium Tax Credit calculations via `server/lib/premiumTaxCredit.js`.  
- **Batch Quotes**: Runs quotes for entire groups with ZIP→county auto/prompt resolution.  
- **Summary**: Displays employer totals and employee comparisons with carrier/metal/market filters.  
- **Reproducible Data Imports**: Canonical seeding order for all carriers, plans, pricing, and geography.  

---

## Prerequisites

- Node.js **20.x** (≥ 20.12.1 recommended)  
- npm **10+** (bundled with Node 20)  
- MongoDB (local or Atlas)

Optional (recommended): manage Node versions with `nvm`

```bash
nvm install 20.12.1
nvm use 20.12.1
```

---

## MongoDB Setup

This project uses a **non-standard Mongo port (5050)** so the API and DB don’t conflict.

### macOS / Linux

```bash
# Create a local Mongo data directory
mkdir -p ~/mongo-data/ichra

# Run mongod on port 5050
mongod --port 5050 --dbpath ~/mongo-data/ichra
```

### Windows (PowerShell)

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\mongo-data\ichra"
mongod --port 5050 --dbpath "$env:USERPROFILE\mongo-data\ichra"
```

You can also use MongoDB Atlas — just update `MONGO_URI`.

---

## Environment Configuration

You’ll typically need **three `.env` files**.

### Root `.env` (optional; used by `seed.sh`)

```
MONGO_URI=mongodb://localhost:5050/ichra
```

### Server (`/server/.env`)

```
MONGO_URI=mongodb://localhost:5050/ichra
PORT=5050

IDEON_API_KEY=your-ideon-api-key-here
IDEON_BASE_URL=https://api.ideonapi.com
IDEON_RATE_RESERVOIR=100
IDEON_RATE_INTERVAL_MS=60000
IDEON_RATE_MIN_TIME_MS=30
IDEON_RETRY_MAX=5
IDEON_RETRY_BASE_DELAY_MS=300
IDEON_LOG=true
```

### Client (`/client/.env`)

```
REACT_APP_API=http://localhost:5050/api
```

---

## Install Dependencies

Use the lockfiles for reproducible installs:

```bash
npm ci
npm --prefix server ci
npm --prefix scripts ci
npm --prefix client ci
```

If you run `npm install` instead, don’t commit lockfile changes unless you intend to update dependencies.

---

## Database Seeding

We provide a canonical `seed.sh` script that runs all imports in the correct order.

### (Optional) Drop the DB for a clean slate

```bash
mongosh "mongodb://localhost:5050/ichra" --eval 'db.dropDatabase()'
```

### Run the seeder

```bash
./seed.sh
```

**What it does:**
- Installs `/scripts` deps  
- Imports issuers → counties → ZIPs → service areas → rating areas → plans → mappings → pricing  
- Runs `migratePlansIdToPlanId.js` (safe; no-op if already migrated)  
- Builds indexes  
- Prints final collection counts  

### Manual Imports (if needed)

```bash
node scripts/importIssuers.js
node scripts/importCounties.js
node scripts/importZipCounties.js
node scripts/importServiceAreas.js
node scripts/importServiceAreaZipCounties.js
node scripts/importRatingArea.js
node scripts/importPlans_fixed.js
node scripts/migratePlansIdToPlanId.js   # safe to run
node scripts/importPlanCounties.js
node scripts/importPricings_fixed.js
node scripts/createIndexes.js
```

> ⚠️ Don’t mix standard and `_fixed` variants for the same collection.

---

## Development

### Start the Backend

```bash
cd server
npm run dev      # Development with nodemon
# or
npm start        # Production mode
```

Backend API will run at:  
[http://localhost:5050/api](http://localhost:5050/api)

### Start the Frontend

```bash
cd client
npm start
```




Frontend will run at:  
[http://localhost:3000](http://localhost:3000)





## API Documentation (Swagger UI)

Interactive API documentation is available via Swagger UI.

1. Ensure `openapi.yaml` exists in the `/server` directory (or project root if configured there).
2. Start the backend server:
   ```bash
   cd server
   node index.js

3.	Open your browser and navigate to:
http://localhost:5050/api-docs




---

## Workflow

1. **Group** → Create/open a group (invalid IDs gracefully handled).  
2. **Classes** → Define ICHRA classes/subclasses.  
3. **Members** → Add or bulk import members (dependents optional).  
4. **ICHRA** → Run affordability; results persist to DB.  
5. **Quotes** → Run batch quotes (auto/prompt ZIP→county resolution).  
6. **Summary** → Employer totals + employee comparison with filters.  

---

## Premium Tax Credit Logic

Located in `server/lib/premiumTaxCredit.js`.

- Encodes **2025 Federal Poverty Level (FPL)** tables (48 states/DC, Alaska, Hawaii).  
- Implements **ARPA/IRA sliding scale** through 2025:  
  - ≤150% FPL → 0% contribution  
  - 150–200% → 0–2%  
  - 200–250% → 2–4%  
  - 250–300% → 4–6%  
  - 300–400% → 6–8.5%  
  - >400% → capped at 8.5%  

**Key functions:**
- `getFpl(taxYear, householdSize, stateCode)`  
- `applicablePct(fplPercent)`  
- `expectedContributionMonthly(magiAnnual, fplPercent)`  

These are used to compute Premium Tax Credits against benchmark silver plans.

---

## Troubleshooting

- **Filters empty / no plans show** → Check that `plancounties` or `pricings` imported correctly.  
- **Port conflicts** → Confirm Mongo is on port `5050` and `.env` matches.  
- **Node version mismatches** → Use `.nvmrc` (20.12.1) and engines in `package.json`:  

```json
"engines": {
  "node": "20.x",
  "npm": ">=10"
}
```

---

## Contributing

1. Fork this repo  
2. Create a feature branch  
3. Make + test changes  
4. Submit a pull request  

---

## License

TBD