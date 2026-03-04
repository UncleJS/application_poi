#!/usr/bin/env bash
# rebuild.sh — Stop the stack, rebuild all images, start the stack, show status.
#
# Why it exists:
#   The most common development operation after editing API or web source is
#   "rebuild everything and bring it back up".  This script executes that
#   four-step sequence (stop → build → start → status) as a single command so
#   operators do not need to remember the individual scripts or their order.
#
# Usage: ./scripts/rebuild.sh
#   Use after any code change to api/, web/, or containers/ that requires a new
#   image.  For config-only changes (env or Caddyfile) ./scripts/restart.sh is
#   sufficient if the Caddy image is rebuilt separately.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

"${SCRIPT_DIR}/stop.sh"
"${SCRIPT_DIR}/build.sh"
"${SCRIPT_DIR}/start.sh"
"${SCRIPT_DIR}/status.sh"
