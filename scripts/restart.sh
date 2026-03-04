#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

"${SCRIPT_DIR}/stop.sh"
"${SCRIPT_DIR}/start.sh"

"${SCRIPT_DIR}/status.sh"
