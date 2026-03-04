#!/usr/bin/env bash
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

warn "Restore will overwrite current DB state inside ${DB_NAME}."
warn "Continue only if this is intentional."

container_name="poi-db"

log "Stopping API/web/proxy before restore"
systemctl --user stop "poi-api.service" "poi-web.service" "poi-proxy.service" >/dev/null 2>&1 || true

log "Restoring ${dump_file} into ${DB_NAME}"
MYSQL_PWD="${DB_PASSWORD}" podman exec -i -e MYSQL_PWD "${container_name}" mariadb -u"${DB_USER}" "${DB_NAME}" < "${dump_file}"

log "Starting API/web/proxy after restore"
systemctl --user start "poi-api.service" "poi-web.service" "poi-proxy.service"

log "Restore complete"
