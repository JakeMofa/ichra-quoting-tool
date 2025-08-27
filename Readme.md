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
