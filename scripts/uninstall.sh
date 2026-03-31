#!/usr/bin/env bash
# uninstall.sh — Remove all POI-managed machine state while keeping the repo.
#
# Why it exists:
#   "Uninstall" should leave the machine as though this project had never been
#   installed locally.  That means more than removing unit files: the script
#   stops and disables user services, removes Quadlet definitions and masked
#   overrides, tears down the running pod and containers, deletes project-owned
#   local images and volumes, and cleans repo-local generated runtime artifacts.
#
# Usage:
#   ./scripts/uninstall.sh              — full destructive cleanup
#   ./scripts/uninstall.sh --purge-data — compatibility alias for full cleanup
#
# Notes:
#   This removes project runtime data, backups, logs, local build artifacts, and
#   localhost/poi-* images.  The repository checkout itself is kept intact.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd systemctl
require_user_systemd

case "${1:-}" in
  "")
    ;;
  "--purge-data")
    warn "--purge-data is now redundant; uninstall always removes POI data."
    ;;
  *)
    die "Unsupported argument: ${1}. Usage: ./scripts/uninstall.sh [--purge-data]"
    ;;
esac

SYSTEMD_UNITS=(
  "poi-pod.service"
  "${STACK_SERVICES[@]}"
  "${STACK_AUX_UNITS[@]}"
)

PODMAN_CONTAINERS=(
  "poi-db"
  "poi-api"
  "poi-web"
  "poi-proxy"
  "poi-phpmyadmin"
  "poi-dev"
)

LOCAL_IMAGES=(
  "localhost/poi-api:latest"
  "localhost/poi-web:latest"
  "localhost/poi-proxy:latest"
  "localhost/poi-dev:latest"
)

remove_path_if_present() {
  local path="$1"
  if [[ -e "${path}" || -L "${path}" ]]; then
    rm -rf "${path}"
    log "Removed ${path}"
  fi
}

remove_glob_matches() {
  local pattern="$1"
  local matches=()
  mapfile -t matches < <(compgen -G "${pattern}" || true)

  if (( ${#matches[@]} > 0 )); then
    rm -rf "${matches[@]}"
    log "Removed ${#matches[@]} path(s) matching ${pattern}"
  fi
}

log "Stopping, disabling, and unmasking POI user units"
for unit in "${SYSTEMD_UNITS[@]}"; do
  systemctl --user disable --now "${unit}" >/dev/null 2>&1 || true
  systemctl --user unmask "${unit}" >/dev/null 2>&1 || true
done

log "Removing POI pod and containers"
podman pod rm -f "poi" >/dev/null 2>&1 || warn "Pod poi not removed (may not exist)."
for container in "${PODMAN_CONTAINERS[@]}"; do
  podman rm -f "${container}" >/dev/null 2>&1 || true
done

log "Removing installed Quadlet files and user overrides"
remove_glob_matches "${USER_QUADLET_DIR}/poi-*.container"
remove_glob_matches "${USER_QUADLET_DIR}/poi-*.volume"
remove_path_if_present "${USER_QUADLET_DIR}/poi.pod"
remove_glob_matches "${USER_SYSTEMD_DIR}/poi-*.service"
remove_glob_matches "${USER_SYSTEMD_DIR}/poi-*.timer"

systemctl --user daemon-reload
systemctl --user reset-failed >/dev/null 2>&1 || true

log "Removing POI local images"
for image in "${LOCAL_IMAGES[@]}"; do
  podman image rm -f "${image}" >/dev/null 2>&1 || true
done

log "Removing POI persistent data"
podman volume rm -f "poi-db-data" >/dev/null 2>&1 || warn "Volume poi-db-data not removed (may not exist)."

log "Removing repo-local generated artifacts"
remove_path_if_present "${STACK_CONFIG_DIR}"
remove_path_if_present "${PROJECT_ROOT}/web/.next"
remove_path_if_present "${PROJECT_ROOT}/.quadlet"

shopt -s globstar nullglob
generated_paths=(
  "${PROJECT_ROOT}"/**/node_modules
  "${PROJECT_ROOT}"/**/dist
  "${PROJECT_ROOT}"/**/build
)
shopt -u globstar nullglob

for path in "${generated_paths[@]}"; do
  remove_path_if_present "${path}"
done

log "Uninstall complete. Repository files remain; POI runtime state has been removed."
