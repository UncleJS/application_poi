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

container_name="poi-db"

log "Creating backup ${outfile}"
podman exec "${container_name}" mariadb-dump \
  --single-transaction \
  --quick \
  --lock-tables=false \
  -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" > "${outfile}"

log "Backup complete: ${outfile}"
