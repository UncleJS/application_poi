#!/usr/bin/env bash
# migrate.sh — Apply pending SQL migrations to the running poi-db container.
#
# Why it exists:
#   Schema changes are tracked in db/migrations/ as sequential *.sql files.
#   This script runs inside the poi-db container via podman exec, checks a
#   schema_migrations tracking table, and only applies files that have not
#   been recorded there.  This makes it idempotent and safe to run on every
#   start — already-applied files are skipped with a log message.
#
# Usage: ./scripts/migrate.sh
#   Requires poi-db to be running.  Called automatically by start.sh and
#   install.sh.  Run manually after dropping in a new migration file.
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
