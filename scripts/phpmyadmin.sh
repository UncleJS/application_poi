#!/usr/bin/env bash
# phpmyadmin.sh — Convenience wrapper to start the phpMyAdmin service.
#
# Why it exists:
#   phpMyAdmin is managed as a Quadlet container unit (poi-phpmyadmin.service)
#   that runs inside the poi pod alongside the rest of the stack.  This script
#   provides a memorable entry point for operators who want to start or check
#   phpMyAdmin without remembering the full systemctl syntax.
#
# Usage: ./scripts/phpmyadmin.sh
#   phpMyAdmin is accessible at http://localhost:9010/phpmyadmin/
#   Log in with the MariaDB credentials from .runtime/poi.env.
#   Under normal operation poi-phpmyadmin starts automatically with the stack
#   via start.sh — this script is only needed if the service was stopped manually.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

log "Starting poi-phpmyadmin.service"
systemctl --user start "poi-phpmyadmin.service"
log "poi-phpmyadmin started — access at http://localhost:9010/phpmyadmin/"
