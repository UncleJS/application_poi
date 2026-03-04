#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9010}"

check() {
  local endpoint="$1"
  local mode="${2:-strict}"
  local url="${BASE_URL}${endpoint}"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "${url}" || true)"
  if [[ "${code}" =~ ^[23] ]]; then
    printf '[OK] %s -> %s\n' "${endpoint}" "${code}"
  elif [[ "${mode}" == "docs" && "${code}" == "401" ]]; then
    printf '[OK] %s -> %s (docs auth enabled)\n' "${endpoint}" "${code}"
  else
    printf '[FAIL] %s -> %s\n' "${endpoint}" "${code}"
    return 1
  fi
}

check "/health"
check "/ready"
check "/openapi.json" "docs"
check "/docs" "docs"
