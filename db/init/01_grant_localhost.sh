#!/bin/bash
# 01_grant_localhost.sh
# Runs once on first DB boot via /docker-entrypoint-initdb.d/
#
# Why: the official mariadb image creates MARIADB_USER with host='%'.
# When migrate.sh (and the API) connect via `podman exec ... mariadb`,
# the client authenticates via Unix socket which MariaDB resolves as
# 'localhost' — not matched by '%'.  This grant covers that socket path
# without weakening the existing '%' grant used for inter-container TCP.

set -euo pipefail

mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
GRANT ALL PRIVILEGES ON \`${MARIADB_DATABASE}\`.* TO '${MARIADB_USER}'@'localhost' IDENTIFIED BY '${MARIADB_PASSWORD}';
FLUSH PRIVILEGES;
SQL
