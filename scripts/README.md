[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# scripts/

Shell automation for the full POI stack lifecycle — install, build, operate, test, backup, and clean up.

All scripts source `common.sh` for shared paths, the service list, and helper functions.
Run every script from the **project root** (`./scripts/<name>.sh`), not from inside this directory.

---

## Table of Contents

- [Quick reference](#quick-reference)
- [common.sh](#commonsh)
- [install.sh](#installsh)
- [build.sh](#buildsh)
- [rebuild.sh](#rebuildsh)
- [start.sh](#startsh)
- [stop.sh](#stopsh)
- [restart.sh](#restartsh)
- [status.sh](#statussh)
- [logs.sh](#logssh)
- [health.sh](#healthsh)
- [migrate.sh](#migratesh)
- [env-check.sh](#env-checksh)
- [backup.sh](#backupsh)
- [restore.sh](#restoresh)
- [uninstall.sh](#uninstallsh)
- [reset-dev.sh](#reset-devsh)
- [phpmyadmin.sh](#phpmyadminsh)
- [test-integration.sh](#test-integrationsh)
- [test-nightly.sh](#test-nightlysh)

---

## Quick reference

| Script | Purpose | Safe to repeat? |
|---|---|---|
| [`common.sh`](#commonsh) | Shared bootstrap — sourced by all scripts, never run directly | — |
| [`install.sh`](#installsh) | First-time setup: install units, start stack, run migrations | Yes |
| [`build.sh`](#buildsh) | Build Podman images for api, web, and proxy | Yes |
| [`rebuild.sh`](#rebuildsh) | Stop → build → start → status in one command | Yes |
| [`start.sh`](#startsh) | Start all services in dependency order | Yes |
| [`stop.sh`](#stopsh) | Gracefully stop all services | Yes |
| [`restart.sh`](#restartsh) | Stop then start (config/env changes, no rebuild needed) | Yes |
| [`status.sh`](#statussh) | Show service states and running containers | Yes |
| [`logs.sh`](#logssh) | Tail journald logs for a named service | Yes |
| [`health.sh`](#healthsh) | HTTP smoke-test against the four canonical endpoints | Yes |
| [`migrate.sh`](#migratesh) | Apply pending SQL migrations (idempotent) | Yes |
| [`env-check.sh`](#env-checksh) | Validate all required env vars are present | Yes |
| [`backup.sh`](#backupsh) | Create a timestamped MariaDB SQL dump | Yes |
| [`restore.sh`](#restoresh) | Restore a SQL dump — **destructive** | With care |
| [`uninstall.sh`](#uninstallsh) | Remove systemd units; optionally purge DB volume | With care |
| [`reset-dev.sh`](#reset-devsh) | Wipe DB volume and restart clean — **dev only** | Dev only |
| [`phpmyadmin.sh`](#phpmyadminsh) | Start the phpMyAdmin service manually | Yes |
| [`test-integration.sh`](#test-integrationsh) | End-to-end API integration test against the live stack | Yes |
| [`test-nightly.sh`](#test-nightlysh) | Nightly wrapper: runs integration tests and retains logs | Yes |

[Go to TOC](#table-of-contents)

---

## common.sh

**Sourced by all other scripts. Never executed directly.**

Defines every shared constant and helper used across the automation layer:

- **Path constants** — `PROJECT_ROOT`, `USER_QUADLET_DIR`, `STACK_ENV_FILE`, `BACKUP_DIR`, `LOG_DIR`, etc.
- **Service lists** — `STACK_SERVICES` (the five pod containers) and `STACK_AUX_UNITS` (backup/integration timers).
- **Helper functions** — `log`, `warn`, `die`, `require_cmd`, `require_user_systemd`, `ensure_dirs`, `ensure_env_file`, `load_env_file`, `wait_for_db`.

`load_env_file` parses `.runtime/poi.env` and exports every key, stripping optional quote wrapping. `wait_for_db` polls the `poi-db` container until MariaDB accepts connections (default 90 s timeout).

[Go to TOC](#table-of-contents)

---

## install.sh

```bash
./scripts/install.sh
```

First-time setup on a new machine or after moving the project to a new path.

1. Validates required commands and a live systemd user session.
2. Runs `env-check.sh` to catch missing secrets early.
3. Copies `.container`, `.pod`, and `.volume` Quadlet files from `infra/quadlet/` into `~/.config/containers/systemd/`, substituting the `__PROJECT_ROOT__` placeholder with the real path.
4. Copies `infra/systemd/` service and timer files into `~/.config/systemd/user/`.
5. Reloads the systemd daemon.
6. Enables all stack services and timers.
7. Starts the DB, waits for readiness, runs `migrate.sh`, then starts the rest of the stack.
8. Enables and starts the backup and nightly integration timers.

Safe to re-run — unit files are overwritten and migrations are idempotent.

[Go to TOC](#table-of-contents)

---

## build.sh

```bash
./scripts/build.sh
```

Builds the three locally-tagged Podman images used by the stack:

| Image | Containerfile |
|---|---|
| `localhost/poi-api:latest` | `containers/api/Containerfile` |
| `localhost/poi-web:latest` | `containers/web/Containerfile` |
| `localhost/poi-proxy:latest` | `containers/proxy/Containerfile` |

The project root is used as the build context so both `api/` and `web/` source trees are available to each build. Missing Containerfiles are skipped with a warning rather than failing the script.

Run this after any code change in `api/`, `web/`, or `containers/` before restarting services. For a combined stop → build → start cycle, use `rebuild.sh` instead.

[Go to TOC](#table-of-contents)

---

## rebuild.sh

```bash
./scripts/rebuild.sh
```

Convenience wrapper for the most common development operation: full stop → build → start → status.

Calls, in order: `stop.sh` → `build.sh` → `start.sh` → `status.sh`.

Use after any change that requires a new image (API code, frontend code, Containerfile, Caddyfile). For config-only changes (env file edits without image changes) `restart.sh` is faster.

[Go to TOC](#table-of-contents)

---

## start.sh

```bash
./scripts/start.sh
```

Starts all stack services in the correct dependency order:

1. Starts `poi-db.service` and waits until MariaDB is ready (via `wait_for_db`).
2. Runs `migrate.sh` to apply any pending schema migrations.
3. Starts `poi-api.service`, `poi-web.service`, `poi-proxy.service`, and `poi-phpmyadmin.service`.
4. Prints service status via `status.sh`.

Also called internally by `rebuild.sh` and `restart.sh`.

[Go to TOC](#table-of-contents)

---

## stop.sh

```bash
./scripts/stop.sh
```

Stops all services in `STACK_SERVICES` (db, api, web, proxy, phpmyadmin). Errors for already-stopped units are suppressed so the script is safe to call repeatedly.

Does **not** disable services or remove unit files — use `uninstall.sh` for that. Does **not** stop backup or integration timers, which should persist across restarts.

[Go to TOC](#table-of-contents)

---

## restart.sh

```bash
./scripts/restart.sh
```

Calls `stop.sh` then `start.sh`, then prints status. Use when a config or env change needs to be picked up without rebuilding images (e.g. after editing `.runtime/poi.env`).

For changes that require new images, use `rebuild.sh` instead.

[Go to TOC](#table-of-contents)

---

## status.sh

```bash
./scripts/status.sh
```

Prints a two-column table of every service and timer in the stack with its current `systemctl` active state, followed by the live `podman ps` container listing with port mappings.

Called automatically at the end of `install.sh`, `rebuild.sh`, and `restart.sh`.

Example output:

```
SERVICE              STATE
-------------------- ------------
poi-db.service       active
poi-api.service      active
poi-web.service      active
poi-proxy.service    active
poi-phpmyadmin.service active
poi-backup.service   inactive
poi-backup.timer     active
...
```

[Go to TOC](#table-of-contents)

---

## logs.sh

```bash
./scripts/logs.sh <target>
```

Tails the journald log stream for the named service using `journalctl --user -f`.

| Target | Service |
|---|---|
| `db` | `poi-db.service` |
| `api` | `poi-api.service` |
| `web` | `poi-web.service` |
| `proxy` | `poi-proxy.service` |
| `phpmyadmin` | `poi-phpmyadmin.service` |

Defaults to `proxy` if no target is given. Press `Ctrl-C` to stop tailing.

[Go to TOC](#table-of-contents)

---

## health.sh

```bash
./scripts/health.sh

# Against a non-default host/port:
BASE_URL=http://myhost:9010 ./scripts/health.sh
```

Sends HTTP requests to the four canonical stack endpoints and prints `[OK]` or `[FAIL]` with the HTTP status code for each:

| Endpoint | Expected |
|---|---|
| `/health` | 2xx |
| `/ready` | 2xx |
| `/openapi.json` | 2xx or 401 (if docs auth enabled) |
| `/docs` | 2xx or 401 (if docs auth enabled) |

Exits non-zero on the first failure. Safe to use as a post-deploy gate in CI or in scripts.

[Go to TOC](#table-of-contents)

---

## migrate.sh

```bash
./scripts/migrate.sh
```

Applies pending SQL migration files from `db/migrations/` to the running `poi-db` container.

- Creates a `schema_migrations` tracking table on first run if it does not exist.
- Iterates `db/migrations/*.sql` in filename order.
- Skips any file already recorded in `schema_migrations`.
- Records each newly applied file so it is never re-applied.

Idempotent — safe to run on every `start.sh` and `install.sh`. Run manually after dropping a new `.sql` file into `db/migrations/`.

[Go to TOC](#table-of-contents)

---

## env-check.sh

```bash
./scripts/env-check.sh
```

Loads `.runtime/poi.env` and checks that every required environment variable is present and non-empty. Prints `[OK]` or `[MISSING]` for each key and exits non-zero if any are absent.

Called automatically by `install.sh`. Run manually after editing the env file to catch typos before restarting services.

Required variables checked: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `MARIADB_*`, `JWT_*`, `ADMIN_USER`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, `UPLOAD_MAX_BYTES`, `PHOTO_MAX_PER_POI`, `OSM_TILE_URL`, `OSM_ATTRIBUTION`, `DOCS_AUTH_*`, `NIGHTLY_LOG_RETAIN_COUNT`, `BACKUP_RETAIN_COUNT`.

[Go to TOC](#table-of-contents)

---

## backup.sh

```bash
./scripts/backup.sh
```

Creates a timestamped `mariadb-dump` from the running `poi-db` container and writes it to `.runtime/backups/poi_<UTC-timestamp>.sql`.

- Uses `--single-transaction --quick` for a consistent, non-blocking dump.
- Retains the `N` most recent files (controlled by `BACKUP_RETAIN_COUNT` in `poi.env`, default `30`). Older files are deleted automatically.

Run manually before any destructive operation (schema change, restore). Also invoked automatically by the `poi-backup.timer` systemd timer (daily at 02:15).

Restore a dump with:
```bash
./scripts/restore.sh .runtime/backups/<file>.sql
```

[Go to TOC](#table-of-contents)

---

## restore.sh

```bash
./scripts/restore.sh /path/to/backup.sql
```

**Destructive — overwrites the current database.**

Restores a SQL dump into the running `poi-db` container:

1. Stops `poi-api`, `poi-web`, and `poi-proxy` to prevent partial reads during import.
2. Streams the dump into MariaDB via `podman exec`.
3. Restarts the stopped services.

Always take a fresh backup before restoring:
```bash
./scripts/backup.sh
./scripts/restore.sh .runtime/backups/<latest>.sql
```

[Go to TOC](#table-of-contents)

---

## uninstall.sh

```bash
# Remove units, keep database volume:
./scripts/uninstall.sh

# Remove units AND delete all database data:
./scripts/uninstall.sh --purge-data
```

Cleanly removes the POI stack from the system:

1. Stops and disables all stack services and timers.
2. Removes Quadlet unit files (`.container`, `.pod`, `.volume`) from `~/.config/containers/systemd/`.
3. Removes timer/service files from `~/.config/systemd/user/`.
4. Reloads the systemd daemon.

Without `--purge-data`, the `poi-db-data` Podman volume is preserved so data survives a reinstall. With `--purge-data`, the volume is deleted — **this is irreversible**.

[Go to TOC](#table-of-contents)

---

## reset-dev.sh

```bash
./scripts/reset-dev.sh
```

**Destructive — for local development only. Do not run in production.**

Stops all services, removes the `poi-db-data` Podman volume, and starts the stack fresh. Migrations are re-applied from scratch on startup.

Use when you want a clean database for testing migrations, seeding fixture data, or reproducing a first-install scenario.

[Go to TOC](#table-of-contents)

---

## phpmyadmin.sh

```bash
./scripts/phpmyadmin.sh
```

Starts the `poi-phpmyadmin.service` unit manually. Under normal operation phpMyAdmin starts automatically with the rest of the stack via `start.sh` — this script is only needed if the service was stopped in isolation.

Once started, phpMyAdmin is accessible at:
```
http://localhost:9010/phpmyadmin/
```

Log in with the MariaDB credentials from `.runtime/poi.env` (`DB_USER` / `DB_PASSWORD`).

[Go to TOC](#table-of-contents)

---

## test-integration.sh

```bash
./scripts/test-integration.sh

# Against a non-default host:
BASE_URL=http://myhost:9010 ./scripts/test-integration.sh
```

End-to-end integration test against the live, running stack. Exercises the full critical path:

1. Health endpoint checks
2. Admin login → access + refresh tokens
3. Token refresh
4. Fetch categories (resolves a `categoryId` for POI creation)
5. Create POI
6. Search POIs (`scope=mine`)
7. Upload photo
8. Archive and restore photo
9. Archive and restore POI
10. Radius query

All test data is created and archived within the run — no manual cleanup needed. Exits non-zero on the first failure with a descriptive message.

Requires the full stack to be running. Reads `ADMIN_USER` and `ADMIN_PASSWORD` from `.runtime/poi.env` and refuses to run if the password is still the default placeholder.

Also invoked automatically by `test-nightly.sh`.

[Go to TOC](#table-of-contents)

---

## test-nightly.sh

```bash
./scripts/test-nightly.sh
```

Nightly wrapper around `test-integration.sh` that adds log file management:

- Runs `test-integration.sh` and captures all output to `.runtime/logs/integration_<UTC-timestamp>.log`.
- Updates `.runtime/logs/integration_latest.log` as a symlink to the most recent run.
- Prunes old log files, keeping only the `N` most recent (controlled by `NIGHTLY_LOG_RETAIN_COUNT` in `poi.env`, default `14`).

Invoked automatically by the `poi-integration.timer` systemd timer (daily at 02:45). Run manually to verify the nightly pipeline:

```bash
systemctl --user start poi-integration.service
cat .runtime/logs/integration_latest.log
```

[Go to TOC](#table-of-contents)

---

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
