#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd systemctl
require_user_systemd

PURGE_DATA="false"
if [[ "${1:-}" == "--purge-data" ]]; then
  PURGE_DATA="true"
fi

log "Stopping and disabling services"
for svc in "${STACK_SERVICES[@]}"; do
  systemctl --user disable --now "${svc}" >/dev/null 2>&1 || true
done

for unit in "${STACK_AUX_UNITS[@]}"; do
  systemctl --user disable --now "${unit}" >/dev/null 2>&1 || true
done

log "Removing Quadlet unit files"
rm -f "${USER_QUADLET_DIR}/poi-"*.container
rm -f "${USER_QUADLET_DIR}/poi.network" "${USER_QUADLET_DIR}/poi-db.volume"
rm -f "${USER_SYSTEMD_DIR}/poi-backup.service" "${USER_SYSTEMD_DIR}/poi-backup.timer"

systemctl --user daemon-reload

if [[ "${PURGE_DATA}" == "true" ]]; then
  warn "Purging persistent DB volume data"
  podman volume rm "poi-db-data" >/dev/null 2>&1 || warn "Volume poi-db-data not removed (may not exist)."
fi

log "Uninstall complete"
