#!/usr/bin/env bash
# Start a phpMyAdmin container joined to the poi network.
# phpMyAdmin uses login-form authentication — no passwordless/config login.
# Access at: http://localhost:9010/phpmyadmin/
#
# Usage:
#   ./scripts/phpmyadmin.sh [absolute-uri]
#
# Optional argument:
#   absolute-uri   Full base URL where phpMyAdmin is served, including trailing slash.
#                  Default: http://localhost:9010/phpmyadmin/
#                  Override if accessing the app from a non-localhost hostname, e.g.:
#                    ./scripts/phpmyadmin.sh http://192.168.1.10:9010/phpmyadmin/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

ABSOLUTE_URI="${1:-http://localhost:9010/phpmyadmin/}"
CONTAINER_NAME="poi-phpmyadmin"
IMAGE="docker.io/phpmyadmin:latest"

log "Pulling ${IMAGE}"
podman pull "${IMAGE}"

log "Starting ${CONTAINER_NAME}"
podman run -d \
  --name "${CONTAINER_NAME}" \
  --replace \
  --network poi \
  -e PMA_HOST=poi-db \
  -e PMA_ABSOLUTE_URI="${ABSOLUTE_URI}" \
  "${IMAGE}"

log "${CONTAINER_NAME} started"
log "Access phpMyAdmin at ${ABSOLUTE_URI}"
log "Log in with a valid MariaDB username and password (login-form auth)."
