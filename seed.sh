#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------
# ICHRA one-shot seeder (NO DROP)
# - Installs /scripts deps
# - Runs all imports in canonical order
# - Uses *_fixed variants for plans & pricings
# - Runs migratePlansIdToPlanId (safe if not needed)
# - Builds indexes and prints collection counts
#
# Env:
#   MONGO_URI (optional) — defaults to mongodb://localhost:5050/ichra
#   A .env at repo root will be sourced if present.
# -------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${ROOT_DIR}/.env" | sed 's/\r$//' | xargs -I {} bash -c 'echo {}' | xargs)
fi

MONGO_URI="${MONGO_URI:-mongodb://localhost:5050/ichra}"

banner () { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
need () { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }

need node
need npm
need mongosh

banner "Using MONGO_URI: ${MONGO_URI}"

# Install deps for /scripts
banner "Installing /scripts dependencies…"
pushd "${ROOT_DIR}/scripts" >/dev/null
npm i
popd >/dev/null

# ---- Seed in canonical order --------------------------------------
banner "Seeding: Issuers"
node scripts/importIssuers.js

banner "Seeding: Counties"
node scripts/importCounties.js

banner "Seeding: ZIP ↔ County"
node scripts/importZipCounties.js

banner "Seeding: Service Areas"
node scripts/importServiceAreas.js
node scripts/importServiceAreaZipCounties.js

banner "Seeding: Rating Areas"
node scripts/importRatingArea.js

banner "Seeding: Plans (fixed)"
node scripts/importPlans_fixed.js

# Safe to run; no-ops if plan_id already present
banner "Migrating plans _id → plan_id (safe)"
node scripts/migratePlansIdToPlanId.js || true

banner "Seeding: Plan ↔ County mapping"
node scripts/importPlanCounties.js

banner "Seeding: Pricings (fixed)"
node scripts/importPricings_fixed.js

banner "Creating indexes"
node scripts/createIndexes.js

# ---- Final verification --------------------------------------------
banner "Verifying collection counts"
mongosh "${MONGO_URI}" --eval '
  function c(n){ return db.getCollection(n).count(); }
  printjson({
    counties: c("counties"),
    issuers: c("issuers"),
    zipcounties: c("zipcounties"),
    serviceareas: c("serviceareas"),
    serviceareazipcounties: c("serviceareazipcounties"),
    ratingareas: c("ratingareas"),
    plans: c("plans"),
    plancounties: c("plancounties"),
    pricings: c("pricings")
  });
'

banner "Seed complete ✅"