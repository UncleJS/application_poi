#!/usr/bin/env bash
# common.sh — Shared bootstrap for all lifecycle scripts.
#
# Why it exists:
#   Every script in this directory needs the same resolved paths, the same list
#   of managed services, and the same helper functions (log/warn/die, env loader,
#   DB readiness probe).  Centralising these here means a single source of truth
#   and avoids silent drift when services or directories are added.
#
# Usage: sourced at the top of other scripts — never executed directly.
#   source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
QUADLET_SRC_DIR="${PROJECT_ROOT}/infra/quadlet"
USER_QUADLET_DIR="${HOME}/.config/containers/systemd"
USER_SYSTEMD_DIR="${HOME}/.config/systemd/user"
STACK_CONFIG_DIR="${PROJECT_ROOT}/.runtime"
STACK_ENV_FILE="${STACK_CONFIG_DIR}/poi.env"
BACKUP_DIR="${STACK_CONFIG_DIR}/backups"
LOG_DIR="${STACK_CONFIG_DIR}/logs"
SYSTEMD_SRC_DIR="${PROJECT_ROOT}/infra/systemd"

STACK_SERVICES=(
  "poi-db.service"
  "poi-api.service"
  "poi-web.service"
  "poi-proxy.service"
  "poi-phpmyadmin.service"
)

STACK_AUX_UNITS=(
  "poi-backup.service"
  "poi-backup.timer"
  "poi-integration.service"
  "poi-integration.timer"
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
  mkdir -p "${USER_QUADLET_DIR}" "${USER_SYSTEMD_DIR}" "${STACK_CONFIG_DIR}" "${BACKUP_DIR}" "${LOG_DIR}"
}

ensure_env_file() {
  if [[ ! -f "${STACK_ENV_FILE}" ]]; then
    cp "${PROJECT_ROOT}/.env.example" "${STACK_ENV_FILE}"
    warn "Created ${STACK_ENV_FILE}. Edit secrets before starting services."
  fi
}

load_env_file() {
  [[ -f "${STACK_ENV_FILE}" ]] || die "Missing env file: ${STACK_ENV_FILE}"

  while IFS= read -r raw || [[ -n "${raw}" ]]; do
    line="${raw%$'\r'}"
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" == *"="* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="$(printf '%s' "${key}" | tr -d '[:space:]')"

    if [[ "${value}" =~ ^".*"$ ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value}" =~ ^'.*'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "${key}=${value}"
  done < "${STACK_ENV_FILE}"
}

wait_for_db() {
  local timeout_seconds="${1:-90}"
  local elapsed=0
  load_env_file

until MYSQL_PWD="${DB_PASSWORD}" podman exec -e MYSQL_PWD poi-db mariadb-admin -u"${DB_USER}" ping --silent >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_seconds )); then
      die "Timed out waiting for DB readiness"
    fi
  done
}
