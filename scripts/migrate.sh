#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

load_env_file

MIGRATIONS_DIR="${PROJECT_ROOT}/db/migrations"
[[ -d "${MIGRATIONS_DIR}" ]] || die "Missing migrations directory: ${MIGRATIONS_DIR}"

MYSQL_PWD="${DB_PASSWORD}" podman exec -e MYSQL_PWD poi-db mariadb -u"${DB_USER}" "${DB_NAME}" -e "CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

for file in "${MIGRATIONS_DIR}"/*.sql; do
  [[ -f "${file}" ]] || continue
  base="$(basename "${file}")"
  applied="$(MYSQL_PWD="${DB_PASSWORD}" podman exec -e MYSQL_PWD poi-db mariadb -u"${DB_USER}" "${DB_NAME}" -Nse "SELECT COUNT(*) FROM schema_migrations WHERE filename='${base}'")"
  if [[ "${applied}" == "0" ]]; then
    log "Applying migration ${base}"
    MYSQL_PWD="${DB_PASSWORD}" podman exec -i -e MYSQL_PWD poi-db mariadb -u"${DB_USER}" "${DB_NAME}" < "${file}"
    MYSQL_PWD="${DB_PASSWORD}" podman exec -e MYSQL_PWD poi-db mariadb -u"${DB_USER}" "${DB_NAME}" -e "INSERT INTO schema_migrations (filename) VALUES ('${base}')"
  else
    log "Skipping already applied migration ${base}"
  fi
done

log "Migrations applied"
