#!/usr/bin/env bash
# backup.sh — Create a timestamped MariaDB SQL dump inside the poi-db container.
#
# Why it exists:
#   The project follows an archive-only data lifecycle (no hard deletes), but a
#   database dump provides a point-in-time recovery option in case of volume
#   corruption or accidental schema changes.  This script writes dumps to
#   .runtime/backups/ with UTC timestamps, and trims old files to the retention
#   limit (BACKUP_RETAIN_COUNT, default 30) so disk space does not grow without
#   bound.
#
# Usage: ./scripts/backup.sh
#   Runs automatically on a nightly schedule via poi-backup.timer.
#   Run manually before any destructive operation (schema change, restore).
#   Restore a dump with: ./scripts/restore.sh .runtime/backups/<file>.sql
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
