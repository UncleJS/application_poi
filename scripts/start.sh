#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

for svc in "${STACK_SERVICES[@]}"; do
  log "Starting ${svc}"
  systemctl --user start "${svc}"
done

"${SCRIPT_DIR}/status.sh"
