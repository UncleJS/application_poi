#!/usr/bin/env bash
# start.sh — Start the POI pod and all stack services in dependency order.
#
# Why it exists:
#   The database must be fully ready before the API starts, and migrations must
#   be applied before traffic is served.  This script enforces that ordering:
#   DB → wait for readiness → migrate → API/web/proxy/phpmyadmin in parallel.
#   Starting services individually with systemctl risks race conditions.
#
# Usage: ./scripts/start.sh
#   Also called internally by rebuild.sh and restart.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

log "Starting poi-db.service"
systemctl --user start "poi-db.service"
wait_for_db

"${SCRIPT_DIR}/migrate.sh"

for svc in "poi-api.service" "poi-web.service" "poi-proxy.service" "poi-phpmyadmin.service"; do
  log "Starting ${svc}"
  systemctl --user start "${svc}"
done

"${SCRIPT_DIR}/status.sh"
