# ICHRA Quoting Tool

A comprehensive health insurance quoting tool for Individual Coverage Health Reimbursement Arrangements (ICHRA).

## Project Structure

```
ichra-quoting-tool/
├── client/          # Frontend application
├── server/          # Backend API server
├── scripts/         # Data import utilities
├── data/           # CSV data files
├── shared/         # Shared utilities
└── .env            # Environment configuration
```

## Features

- **Plan Management**: Import and manage health insurance plans from CSV data
- **Carrier/Issuer Data**: Handle insurance carrier information with logos and metadata
- **Geographic Coverage**: Support for service areas, counties, and ZIP code mappings
- **Rating Areas**: Import and manage insurance rating area data
- **RESTful API**: Express.js server with MongoDB integration

## Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Environment Configuration

1. Copy `.env.example` to `.env` (if available) or create a `.env` file in the project root
2. Configure the following variables:
   ```
   MONGO_URI=mongodb://localhost:27017/ichra-quoting
   PORT=5000
   ```

### Installation

1. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

2. Install script dependencies:
   ```bash
   cd scripts
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Data Import

The project includes several import scripts to populate the database:

- `scripts/importPlans.js` - Import health insurance plans
- `scripts/importIssuers.js` - Import insurance carriers/issuers
- `scripts/importCounties.js` - Import county data
- `scripts/importServiceAreas.js` - Import service area mappings
- `scripts/importRatingArea.js` - Import rating areas
- `scripts/importServiceAreaZipCounties.js` - Import ZIP/county mappings

### Running Imports

```bash
# From the scripts directory
node importPlans.js
node importIssuers.js
# ... run other import scripts as needed
```

## Development

### Start the Server

```bash
cd server
npm run dev    # Development mode with nodemon
# or
npm start      # Production mode
```

### Start the Client

```bash
cd client
npm start
```

## Data Sources

The project works with CSV data files located in the `data/` directory:

- `plans.csv` - Health insurance plan data
- `issuers.csv` - Insurance carrier information
- Various geographic and rating area files

## Database Models

### Plan

The main Plan model includes:
- `plan_id` - Unique plan identifier
- `carrier_name` - Insurance carrier name
- `display_name` - Human-readable plan name
- `effective_date` / `expiration_date` - Plan validity period
- `plan_type` - Type of plan (HMO, PPO, etc.)
- `service_area_id` - Geographic service area
- `metal_level` - Plan tier (Bronze, Silver, Gold, Platinum)
- `on_market` / `off_market` - Market availability flags
- `issuer_id` - Reference to insurance issuer

## API Endpoints

(API endpoints will be documented as they are implemented)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

TBD





## Premium Tax Credit Logic

### Why this file exists
The challenge requires calculating premium subsidies for ACA on-market plans.  
The provided CSVs (`plans.csv`, `pricings.csv`, `plan_counties.csv`, etc.) only contain insurance data.  
They do **not** include the Federal Poverty Level (FPL) thresholds or the subsidy sliding scale.  
To perform the subsidy math, we built a reusable library:  
`server/lib/premiumTaxCredit.js`.

### Federal Poverty Level (FPL)
The **FPL values** are published each year by the U.S. Department of Health & Human Services (HHS).  
For 2025, the guidelines specify poverty thresholds for household sizes 1–8, with separate tables for:
- 48 contiguous states + DC
- Alaska (higher thresholds)
- Hawaii (slightly higher thresholds)

If household size > 8, HHS defines an incremental amount per additional person.  
We encoded those in constants like `FPL_2025_48`, `FPL_2025_AK`, `FPL_2025_HI`.

### Applicable Percentage Scale
The **American Rescue Plan Act (ARPA)** and **Inflation Reduction Act (IRA)** define how much of income a household is expected to contribute toward the benchmark plan.  
This scale is valid through 2025 and was implemented as `applicablePct()`:

- ≤150% FPL → 0% expected contribution
- 150–200% → slides from 0% → 2%
- 200–250% → slides 2% → 4%
- 250–300% → slides 4% → 6%
- 300–400% → slides 6% → 8.5%
- >400% → capped at 8.5%

This is the same sliding scale used by Healthcare.gov.

### Functions in `premiumTaxCredit.js`
- `getFpl(taxYear, householdSize, stateCode)` → annual poverty line in dollars.
- `applicablePct(fplPercent)` → household’s expected contribution percentage.
- `expectedContributionMonthly(magiAnnual, fplPercent)` → dollar amount household is expected to contribute per month.

### How it fits into the quoting flow
1. **Member data** provides AGI + add-backs (MAGI).
2. `getFpl()` retrieves the FPL threshold for that household’s size/year.
3. MAGI ÷ FPL → household FPL percentage.
4. `applicablePct()` → expected contribution % of MAGI.
5. Multiply MAGI × % ÷ 12 → monthly expected contribution.
6. Benchmark plan premium – expected contribution = **Premium Tax Credit**.
7. Apply the credit across all on-market plan premiums for that member.

This design keeps the subsidy logic clean, centralized, and easy to update when new HHS/IRS numbers are released.