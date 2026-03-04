#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman

build_if_present() {
  local image_name="$1"
  local context_dir="$2"
  local containerfile="$3"

  if [[ -f "${containerfile}" ]]; then
    log "Building ${image_name} from ${containerfile}"
    podman build -t "${image_name}" -f "${containerfile}" "${context_dir}"
  else
    warn "Skipping ${image_name}; missing ${containerfile}"
  fi
}

build_if_present "localhost/poi-api:latest" "${PROJECT_ROOT}" "${PROJECT_ROOT}/containers/api/Containerfile"
build_if_present "localhost/poi-web:latest" "${PROJECT_ROOT}" "${PROJECT_ROOT}/containers/web/Containerfile"
build_if_present "localhost/poi-proxy:latest" "${PROJECT_ROOT}" "${PROJECT_ROOT}/containers/proxy/Containerfile"

log "Build script finished"
