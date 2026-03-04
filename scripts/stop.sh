#!/usr/bin/env bash
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
