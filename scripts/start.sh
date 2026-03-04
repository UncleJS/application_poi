#!/usr/bin/env bash
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

for svc in "poi-api.service" "poi-web.service" "poi-proxy.service"; do
  log "Starting ${svc}"
  systemctl --user start "${svc}"
done

"${SCRIPT_DIR}/status.sh"
