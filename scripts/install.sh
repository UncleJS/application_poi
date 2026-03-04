#!/usr/bin/env bash
# install.sh — First-time setup: copy Quadlet/systemd units and start the full stack.
#
# Why it exists:
#   Podman Quadlet units must live in ~/.config/containers/systemd/ and the
#   __PROJECT_ROOT__ placeholder must be substituted with the real path before
#   systemd can use them.  This script handles that substitution, reloads the
#   daemon, runs DB migrations, and enables all timers so the stack is fully
#   operational after a single command.
#
# Usage: ./scripts/install.sh
#   Run once on a fresh machine or after moving the project to a new path.
#   Safe to re-run; it will overwrite unit files and re-apply any pending
#   migrations without destroying data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd podman
require_cmd systemctl
require_cmd python
require_user_systemd

ensure_dirs
ensure_env_file
"${SCRIPT_DIR}/env-check.sh"

[[ -d "${QUADLET_SRC_DIR}" ]] || die "Missing Quadlet source directory: ${QUADLET_SRC_DIR}"
[[ -d "${SYSTEMD_SRC_DIR}" ]] || die "Missing systemd source directory: ${SYSTEMD_SRC_DIR}"

log "Installing Quadlet units into ${USER_QUADLET_DIR}"
for file in "${QUADLET_SRC_DIR}"/*.container; do
  python -c "from pathlib import Path; import sys; src=Path(sys.argv[1]).read_text(); Path(sys.argv[2]).write_text(src.replace('__PROJECT_ROOT__', sys.argv[3]))" "${file}" "${USER_QUADLET_DIR}/$(basename "${file}")" "${PROJECT_ROOT}"
done
cp "${QUADLET_SRC_DIR}"/*.pod "${USER_QUADLET_DIR}/"
cp "${QUADLET_SRC_DIR}"/*.volume "${USER_QUADLET_DIR}/"
for file in "${SYSTEMD_SRC_DIR}"/*.service; do
  python -c "from pathlib import Path; import sys; src=Path(sys.argv[1]).read_text(); Path(sys.argv[2]).write_text(src.replace('__PROJECT_ROOT__', sys.argv[3]))" "${file}" "${USER_SYSTEMD_DIR}/$(basename "${file}")" "${PROJECT_ROOT}"
done
cp "${SYSTEMD_SRC_DIR}"/*.timer "${USER_SYSTEMD_DIR}/"

log "Reloading user systemd daemon"
systemctl --user daemon-reload

log "Enabling and starting POI services"
for svc in "${STACK_SERVICES[@]}"; do
  systemctl --user enable "${svc}" >/dev/null 2>&1 || true
done

systemctl --user start "poi-db.service"
wait_for_db
"${SCRIPT_DIR}/migrate.sh"
systemctl --user start "poi-api.service" "poi-web.service" "poi-proxy.service" "poi-phpmyadmin.service"

log "Enabling backup timer"
for unit in "${STACK_AUX_UNITS[@]}"; do
  systemctl --user enable "${unit}" >/dev/null 2>&1 || true
done
systemctl --user start "poi-backup.timer"
systemctl --user start "poi-integration.timer"

log "Install complete. Current service state:"
"${SCRIPT_DIR}/status.sh"
