#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

load_env_file

required=(
  DB_HOST
  DB_PORT
  DB_NAME
  DB_USER
  DB_PASSWORD
  DB_ROOT_PASSWORD
  MARIADB_DATABASE
  MARIADB_USER
  MARIADB_PASSWORD
  MARIADB_ROOT_PASSWORD
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  JWT_ISSUER
  JWT_AUDIENCE
  ADMIN_USER
  ADMIN_PASSWORD
  CORS_ORIGIN
  UPLOAD_MAX_BYTES
  PHOTO_MAX_PER_POI
  OSM_TILE_URL
  OSM_ATTRIBUTION
)

missing=0
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    printf '[MISSING] %s\n' "${key}"
    missing=1
  else
    printf '[OK] %s\n' "${key}"
  fi
done

if [[ "${missing}" -eq 1 ]]; then
  die "One or more required values are missing in ${STACK_ENV_FILE}."
fi

log "Environment check passed"
