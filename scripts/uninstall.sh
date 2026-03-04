#!/usr/bin/env bash
# uninstall.sh — Remove all POI systemd units and optionally purge DB data.
#
# Why it exists:
#   A clean uninstall requires stopping services, disabling them so they do not
#   restart on login, and removing the installed unit files from the user systemd
#   directory.  Leaving orphan unit files causes daemon-reload warnings.
#
# Usage:
#   ./scripts/uninstall.sh              — stops and removes units, keeps DB volume
#   ./scripts/uninstall.sh --purge-data — also deletes the poi-db-data volume
#
# Notes:
#   --purge-data is irreversible.  Take a backup first: ./scripts/backup.sh
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
rm -f "${USER_QUADLET_DIR}/poi.pod" "${USER_QUADLET_DIR}/poi-db.volume"
rm -f "${USER_SYSTEMD_DIR}/poi-backup.service" "${USER_SYSTEMD_DIR}/poi-backup.timer" "${USER_SYSTEMD_DIR}/poi-integration.service" "${USER_SYSTEMD_DIR}/poi-integration.timer"

systemctl --user daemon-reload

if [[ "${PURGE_DATA}" == "true" ]]; then
  warn "Purging persistent DB volume data"
  podman volume rm "poi-db-data" >/dev/null 2>&1 || warn "Volume poi-db-data not removed (may not exist)."
fi

log "Uninstall complete"
