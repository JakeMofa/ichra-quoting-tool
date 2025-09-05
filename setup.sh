#!/usr/bin/env bash
set -euo pipefail

# Install all Node.js dependencies for this repo using lockfiles (reproducible installs).
# Usage:
#   bash ./setup.sh
# This will install deps in:
#   - repository root (if package.json exists)
#   - scripts/ (if scripts/package.json exists)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install_if_present() {
  local dir="$1"
  if [[ -f "$dir/package.json" ]]; then
    echo "Installing dependencies in $dir ..."
    if [[ -f "$dir/package-lock.json" ]]; then
      npm ci --prefix "$dir"
    else
      npm install --prefix "$dir"
    fi
  else
    echo "No package.json in $dir, skipping"
  fi
}

install_if_present "$ROOT_DIR"
install_if_present "$ROOT_DIR/scripts"

echo "All dependencies installed."
