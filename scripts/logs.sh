#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-proxy}"

case "${TARGET}" in
  db|api|web|proxy) ;;
  *)
    printf 'Usage: %s [db|api|web|proxy]\n' "$0" >&2
    exit 1
    ;;
esac

exec journalctl --user -u "poi-${TARGET}.service" -f
