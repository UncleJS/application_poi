#!/usr/bin/env bash
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
