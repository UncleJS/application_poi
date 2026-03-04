#!/usr/bin/env bash
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
