#!/usr/bin/env bash
# Start the phpMyAdmin service (managed by Quadlet/systemd as part of the poi pod).
# Access at: http://localhost:9010/phpmyadmin/
#
# phpMyAdmin is now a proper Quadlet-managed container in the poi pod.
# This script is a convenience wrapper around systemctl.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

log "Starting poi-phpmyadmin.service"
systemctl --user start "poi-phpmyadmin.service"
log "poi-phpmyadmin started — access at http://localhost:9010/phpmyadmin/"
