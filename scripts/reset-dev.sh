#!/usr/bin/env bash
# reset-dev.sh — Wipe the database volume and restart with a clean slate.
#
# Why it exists:
#   During local development it is often useful to start with an empty database
#   — for example when testing migrations or seeding fresh fixture data.
#   Manually removing a named Podman volume requires knowing the exact volume
#   name and stopping services in the right order first.  This script handles
#   the full sequence safely.
#
# Usage: ./scripts/reset-dev.sh
#   DESTRUCTIVE: all database data is permanently deleted.
#   NOT for use in production — use restore.sh for production recovery.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

warn "This will stop services and purge development database volume."

"${SCRIPT_DIR}/stop.sh"
podman volume rm "poi-db-data" >/dev/null 2>&1 || warn "Volume poi-db-data not found."
"${SCRIPT_DIR}/start.sh"

log "Development reset complete"
