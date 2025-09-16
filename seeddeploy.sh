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
#   Loads server/.env first (preferred), falls back to root .env
# -------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- Load env (prefer server/.env) ---------------------------------
if [[ -f "${ROOT_DIR}/server/.env" ]]; then
  echo ">> loading server/.env"
  set -o allexport
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/server/.env"
  set +o allexport
elif [[ -f "${ROOT_DIR}/.env" ]]; then
  echo ">> loading root .env"
  set -o allexport
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +o allexport
else
  echo ">> no .env found; using default MONGO_URI"
fi

# Prefer IPv4 DNS resolution (helps some Atlas networks)
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Default if still not set
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
npm ci
popd >/dev/null

run() {
  local label="$1"; shift
  banner "Seeding: ${label}"
  # Ensure child process sees the same MONGO_URI
  MONGO_URI="${MONGO_URI}" node "$@"
}

# ---- Seed in canonical order --------------------------------------
run "Issuers"                         "${ROOT_DIR}/scripts/importIssuers.js"
run "Counties"                        "${ROOT_DIR}/scripts/importCounties.js"
run "ZIP ↔ County"                    "${ROOT_DIR}/scripts/importZipCounties.js"
run "Service Areas"                   "${ROOT_DIR}/scripts/importServiceAreas.js"
run "Service Area ↔ ZIP-County"       "${ROOT_DIR}/scripts/importServiceAreaZipCounties.js"
run "Rating Areas"                    "${ROOT_DIR}/scripts/importRatingArea.js"
run "Plans (fixed)"                   "${ROOT_DIR}/scripts/importPlans_fixed.js"

banner "Migrating plans _id → plan_id (safe)"
MONGO_URI="${MONGO_URI}" node "${ROOT_DIR}/scripts/migratePlansIdToPlanId.js" || true

run "Plan ↔ County mapping"           "${ROOT_DIR}/scripts/importPlanCounties.js"
run "Pricings (fixed)"                "${ROOT_DIR}/scripts/importPricings_fixed.js"
run "Indexes"                         "${ROOT_DIR}/scripts/createIndexes.js"

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