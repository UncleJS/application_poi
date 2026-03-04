#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

load_env_file

MIGRATIONS_DIR="${PROJECT_ROOT}/db/migrations"
[[ -d "${MIGRATIONS_DIR}" ]] || die "Missing migrations directory: ${MIGRATIONS_DIR}"

for file in "${MIGRATIONS_DIR}"/*.sql; do
  [[ -f "${file}" ]] || continue
  log "Applying migration $(basename "${file}")"
  podman exec -i poi-db mariadb -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${file}"
done

log "Migrations applied"
