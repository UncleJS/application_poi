#!/usr/bin/env bash
# status.sh — Show the active state of every POI service and running containers.
#
# Why it exists:
#   A quick at-a-glance overview of the entire stack: core services, auxiliary
#   timers (backup and integration), and the live Podman container list with
#   port mappings.  Called at the end of install, rebuild, and restart so the
#   operator always sees the result state without a separate command.
#
# Usage: ./scripts/status.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_cmd podman

printf '%-20s %-12s\n' "SERVICE" "STATE"
printf '%-20s %-12s\n' "--------------------" "------------"
for svc in "${STACK_SERVICES[@]}"; do
  state="$(systemctl --user is-active "${svc}" 2>/dev/null || true)"
  [[ -n "${state}" ]] || state="unknown"
  printf '%-20s %-12s\n' "${svc}" "${state}"
done

for unit in "${STACK_AUX_UNITS[@]}"; do
  state="$(systemctl --user is-active "${unit}" 2>/dev/null || true)"
  [[ -n "${state}" ]] || state="unknown"
  printf '%-20s %-12s\n' "${unit}" "${state}"
done

printf '\n'
log "Running containers"
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
