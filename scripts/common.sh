#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
QUADLET_SRC_DIR="${PROJECT_ROOT}/infra/quadlet"
USER_QUADLET_DIR="${HOME}/.config/containers/systemd"
USER_SYSTEMD_DIR="${HOME}/.config/systemd/user"
STACK_CONFIG_DIR="${HOME}/.config/poi-stack"
STACK_ENV_FILE="${STACK_CONFIG_DIR}/poi.env"
BACKUP_DIR="${STACK_CONFIG_DIR}/backups"
SYSTEMD_SRC_DIR="${PROJECT_ROOT}/infra/systemd"

STACK_SERVICES=(
  "poi-db.service"
  "poi-api.service"
  "poi-web.service"
  "poi-proxy.service"
)

STACK_AUX_UNITS=(
  "poi-backup.service"
  "poi-backup.timer"
)

log() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || die "Missing required command: ${cmd}"
}

require_user_systemd() {
  systemctl --user show-environment >/dev/null 2>&1 || die "systemd user session is not available."
}

ensure_dirs() {
  mkdir -p "${USER_QUADLET_DIR}" "${USER_SYSTEMD_DIR}" "${STACK_CONFIG_DIR}" "${BACKUP_DIR}"
}

ensure_env_file() {
  if [[ ! -f "${STACK_ENV_FILE}" ]]; then
    cp "${PROJECT_ROOT}/.env.example" "${STACK_ENV_FILE}"
    warn "Created ${STACK_ENV_FILE}. Edit secrets before starting services."
  fi
}

load_env_file() {
  [[ -f "${STACK_ENV_FILE}" ]] || die "Missing env file: ${STACK_ENV_FILE}"
  # shellcheck disable=SC1090
  source "${STACK_ENV_FILE}"
}
