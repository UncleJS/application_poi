#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

ensure_dirs

ts="$(date -u +"%Y%m%dT%H%M%SZ")"
log_file="${LOG_DIR}/integration_${ts}.log"
latest_link="${LOG_DIR}/integration_latest.log"
retain_count="${NIGHTLY_LOG_RETAIN_COUNT:-14}"

if ! [[ "${retain_count}" =~ ^[0-9]+$ ]]; then
  retain_count=14
fi

{
  printf '[INFO] Nightly integration test started at %s\n' "${ts}"
  "${SCRIPT_DIR}/test-integration.sh"
  printf '[INFO] Nightly integration test completed successfully\n'
} | tee "${log_file}"

ln -sfn "${log_file}" "${latest_link}"

mapfile -t old_logs < <(ls -1t "${LOG_DIR}"/integration_*.log 2>/dev/null || true)
if (( ${#old_logs[@]} > retain_count )); then
  for old in "${old_logs[@]:retain_count}"; do
    rm -f "${old}"
  done
fi
