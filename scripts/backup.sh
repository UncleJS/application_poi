#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd date

load_env_file
mkdir -p "${BACKUP_DIR}"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
outfile="${BACKUP_DIR}/poi_${timestamp}.sql"
retain_count="${BACKUP_RETAIN_COUNT:-30}"

if ! [[ "${retain_count}" =~ ^[0-9]+$ ]]; then
  retain_count=30
fi

container_name="poi-db"

log "Creating backup ${outfile}"
MYSQL_PWD="${DB_PASSWORD}" podman exec -e MYSQL_PWD "${container_name}" mariadb-dump \
  --single-transaction \
  --quick \
  --lock-tables=false \
  -u"${DB_USER}" "${DB_NAME}" > "${outfile}"

mapfile -t old_backups < <(ls -1t "${BACKUP_DIR}"/poi_*.sql 2>/dev/null || true)
if (( ${#old_backups[@]} > retain_count )); then
  for old in "${old_backups[@]:retain_count}"; do
    rm -f "${old}"
  done
fi

log "Backup complete: ${outfile}"
