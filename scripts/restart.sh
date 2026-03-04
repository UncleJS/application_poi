#!/usr/bin/env bash
# restart.sh — Stop all services then start them again in dependency order.
#
# Why it exists:
#   A plain `systemctl --user restart` on individual units does not honour the
#   DB-readiness wait or the migration step that start.sh provides.  This script
#   ensures a clean restart sequence (stop → start) so the stack comes back up
#   consistently, with migrations applied and health confirmed.
#
# Usage: ./scripts/restart.sh
#   Use for config changes (env file edits, Caddyfile updates after rebuild)
#   where no new image build is needed.  For image changes use rebuild.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_cmd systemctl
require_user_systemd

"${SCRIPT_DIR}/stop.sh"
"${SCRIPT_DIR}/start.sh"

"${SCRIPT_DIR}/status.sh"
