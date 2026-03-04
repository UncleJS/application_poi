#!/usr/bin/env bash
# stop.sh — Gracefully stop all POI stack services.
#
# Why it exists:
#   Stopping services individually is error-prone; this script iterates the
#   canonical STACK_SERVICES list from common.sh so the set is always complete
#   and consistent with start.sh.  Errors for already-stopped units are
#   suppressed so the script is safe to call multiple times.
#
# Usage: ./scripts/stop.sh
#   Does not disable services or remove units — use uninstall.sh for that.
#   Does not stop backup/integration timers — those persist across restarts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

for svc in "${STACK_SERVICES[@]}"; do
  log "Stopping ${svc}"
  systemctl --user stop "${svc}" >/dev/null 2>&1 || true
done

log "All services requested to stop"
