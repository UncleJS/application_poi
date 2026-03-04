#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

dump_file="${1:-}"
[[ -n "${dump_file}" ]] || die "Usage: $0 /path/to/backup.sql"
[[ -f "${dump_file}" ]] || die "Backup file does not exist: ${dump_file}"

load_env_file

warn "Restore will overwrite current DB state inside ${DB_NAME}."
warn "Continue only if this is intentional."

container_name="poi-db"

log "Restoring ${dump_file} into ${DB_NAME}"
podman exec -i "${container_name}" mariadb -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${dump_file}"

log "Restore complete"
