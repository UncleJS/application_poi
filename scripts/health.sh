#!/usr/bin/env bash
# health.sh — HTTP smoke-test against the live stack endpoints.
#
# Why it exists:
#   After any start, restart, or deploy operation the operator needs fast
#   confirmation that the proxy, API, and docs are all reachable and returning
#   expected status codes.  This script checks the four canonical endpoints and
#   exits non-zero on the first failure, making it safe to use in CI pipelines
#   or as a post-deploy gate.
#
# Usage: ./scripts/health.sh
#   Override the base URL: BASE_URL=http://myhost:9010 ./scripts/health.sh
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
