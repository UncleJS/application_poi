#!/usr/bin/env bash
# restore.sh — Restore a SQL dump into the running poi-db container.
#
# Why it exists:
#   When a backup needs to be applied (disaster recovery, staging refresh, or
#   undoing a bad migration) the restore must happen while the API and web
#   containers are stopped to avoid partial reads during the import.  This
#   script stops the application tier, streams the dump into MariaDB, and then
#   brings services back up — all as a single atomic operation.
#
# Usage: ./scripts/restore.sh /path/to/backup.sql
#   DESTRUCTIVE: overwrites current database content.
#   Always take a fresh backup before restoring: ./scripts/backup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd systemctl

dump_file="${1:-}"
[[ -n "${dump_file}" ]] || die "Usage: $0 /path/to/backup.sql"
[[ -f "${dump_file}" ]] || die "Backup file does not exist: ${dump_file}"

load_env_file

warn "Restore will overwrite current DB state inside ${MARIADB_DATABASE}."
warn "Continue only if this is intentional."

container_name="poi-db"

log "Stopping API/web/proxy before restore"
systemctl --user stop "poi-api.service" "poi-web.service" "poi-proxy.service" >/dev/null 2>&1 || true

log "Restoring ${dump_file} into ${MARIADB_DATABASE}"
MYSQL_PWD="${MARIADB_PASSWORD}" podman exec -i -e MYSQL_PWD "${container_name}" mariadb -u"${MARIADB_USER}" "${MARIADB_DATABASE}" < "${dump_file}"

log "Starting API/web/proxy after restore"
systemctl --user start "poi-api.service" "poi-web.service" "poi-proxy.service"

log "Restore complete"
