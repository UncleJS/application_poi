#!/usr/bin/env bash
# logs.sh — Tail the journald log for a specific POI service.
#
# Why it exists:
#   Each container writes to journald via the poi-<name>.service unit.
#   This script wraps the journalctl command so operators do not need to
#   remember the full unit name — just the short service label.
#
# Usage: ./scripts/logs.sh <target>
#   Targets: db | api | web | proxy | phpmyadmin
#   Example: ./scripts/logs.sh api
set -euo pipefail

TARGET="${1:-proxy}"

case "${TARGET}" in
  db|api|web|proxy|phpmyadmin) ;;
  *)
    printf 'Usage: %s [db|api|web|proxy|phpmyadmin]\n' "$0" >&2
    exit 1
    ;;
esac

exec journalctl --user -u "poi-${TARGET}.service" -f
