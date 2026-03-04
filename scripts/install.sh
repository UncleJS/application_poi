#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd systemctl
require_user_systemd

ensure_dirs
ensure_env_file
"${SCRIPT_DIR}/env-check.sh"

[[ -d "${QUADLET_SRC_DIR}" ]] || die "Missing Quadlet source directory: ${QUADLET_SRC_DIR}"
[[ -d "${SYSTEMD_SRC_DIR}" ]] || die "Missing systemd source directory: ${SYSTEMD_SRC_DIR}"

log "Installing Quadlet units into ${USER_QUADLET_DIR}"
cp "${QUADLET_SRC_DIR}"/*.container "${USER_QUADLET_DIR}/"
cp "${QUADLET_SRC_DIR}"/*.network "${USER_QUADLET_DIR}/"
cp "${QUADLET_SRC_DIR}"/*.volume "${USER_QUADLET_DIR}/"
cp "${SYSTEMD_SRC_DIR}"/*.service "${USER_SYSTEMD_DIR}/"
cp "${SYSTEMD_SRC_DIR}"/*.timer "${USER_SYSTEMD_DIR}/"

log "Reloading user systemd daemon"
systemctl --user daemon-reload

log "Enabling and starting POI services"
for svc in "${STACK_SERVICES[@]}"; do
  systemctl --user enable "${svc}" >/dev/null 2>&1 || true
  systemctl --user start "${svc}"
done

log "Enabling backup timer"
for unit in "${STACK_AUX_UNITS[@]}"; do
  systemctl --user enable "${unit}" >/dev/null 2>&1 || true
done
systemctl --user start "poi-backup.timer"
systemctl --user start "poi-integration.timer"

log "Install complete. Current service state:"
"${SCRIPT_DIR}/status.sh"
