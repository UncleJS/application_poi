[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Script Reference

## Table of Contents
- [Purpose](#purpose)
- [Script Catalog](#script-catalog)
- [Bootstrap and Shared Utilities](#bootstrap-and-shared-utilities)
- [Build and Lifecycle Scripts](#build-and-lifecycle-scripts)
- [Data and Validation Scripts](#data-and-validation-scripts)
- [Testing and Scheduling Scripts](#testing-and-scheduling-scripts)
- [Environment Variables Used by Scripts](#environment-variables-used-by-scripts)
- [Recommended Operator Workflow](#recommended-operator-workflow)

## Purpose
This document describes every `*.sh` script in the project, including when to run it, expected behavior, and important safety notes.

[Go to TOC](#table-of-contents)

## Script Catalog
| Script | Role | Typical Usage |
|---|---|---|
| `scripts/common.sh` | Shared helper functions/paths | Sourced by most scripts |
| `scripts/install.sh` | Install Quadlet + user systemd units | `./scripts/install.sh` |
| `scripts/uninstall.sh` | Stop/remove services and units | `./scripts/uninstall.sh --purge-data` |
| `scripts/build.sh` | Build API/web/proxy images with Podman | `./scripts/build.sh` |
| `scripts/rebuild.sh` | Stop, rebuild, start, status | `./scripts/rebuild.sh` |
| `scripts/start.sh` | Start stack services | `./scripts/start.sh` |
| `scripts/stop.sh` | Stop stack services | `./scripts/stop.sh` |
| `scripts/restart.sh` | Restart stack services | `./scripts/restart.sh` |
| `scripts/status.sh` | Show service + timer + container state | `./scripts/status.sh` |
| `scripts/logs.sh` | Tail service logs | `./scripts/logs.sh api` |
| `scripts/health.sh` | Check API/docs health endpoints | `./scripts/health.sh` |
| `scripts/migrate.sh` | Apply SQL migrations | `./scripts/migrate.sh` |
| `scripts/env-check.sh` | Validate required env keys | `./scripts/env-check.sh` |
| `scripts/backup.sh` | Create MariaDB SQL dump | `./scripts/backup.sh` |
| `scripts/restore.sh` | Restore SQL dump into DB | `./scripts/restore.sh /path/to/file.sql` |
| `scripts/reset-dev.sh` | Dev-only DB volume reset | `./scripts/reset-dev.sh` |
| `scripts/test-integration.sh` | End-to-end API integration test | `./scripts/test-integration.sh` |
| `scripts/test-nightly.sh` | Nightly wrapper with log retention | `./scripts/test-nightly.sh` |

[Go to TOC](#table-of-contents)

## Bootstrap and Shared Utilities
### `scripts/common.sh`
- Defines standard paths (`~/.config/poi-stack`, user systemd and Quadlet directories).
- Provides helper functions: `log`, `warn`, `die`, `require_cmd`, `ensure_dirs`, `load_env_file`.
- Declares managed unit arrays: stack services and auxiliary timer/service units.

### `scripts/install.sh`
- Validates dependencies (`podman`, `systemctl`) and user systemd availability.
- Ensures runtime directories and env file exist, then runs `env-check`.
- Copies units from `infra/quadlet/` and `infra/systemd/` into user systemd paths.
- Reloads daemon and starts core services plus backup/integration timers.

### `scripts/uninstall.sh`
- Stops and disables all stack services and timers.
- Removes installed user unit files for stack, backup, and integration jobs.
- Optional `--purge-data` removes `poi-db-data` volume.
- Use without `--purge-data` to keep database files intact.

[Go to TOC](#table-of-contents)

## Build and Lifecycle Scripts
### `scripts/build.sh`
- Builds `localhost/poi-api:latest`, `localhost/poi-web:latest`, and `localhost/poi-proxy:latest`.
- Skips an image with a warning if its `Containerfile` is missing.
- Uses project root as build context.

### `scripts/rebuild.sh`
- Executes `stop -> build -> start -> status` in order.
- Preferred command after code changes touching API/web/proxy.

### `scripts/start.sh`
- Starts `poi-db.service`, `poi-api.service`, `poi-web.service`, and `poi-proxy.service`.
- Prints status at the end.

### `scripts/stop.sh`
- Stops core stack services and ignores already-stopped errors.
- Does not disable timers or uninstall units.

### `scripts/restart.sh`
- Restarts all stack services and prints resulting status.

### `scripts/status.sh`
- Shows active state for core services and auxiliary units (backup/integration).
- Shows running containers and mapped ports via `podman ps`.

### `scripts/logs.sh`
- Follows journald logs for one target service: `db`, `api`, `web`, or `proxy`.
- Usage: `./scripts/logs.sh <target>`.

### `scripts/health.sh`
- Tests `GET /health`, `GET /ready`, `GET /openapi.json`, and `GET /docs`.
- Treats `401` on docs routes as healthy when docs auth is enabled.
- Fails fast on non-healthy responses.

[Go to TOC](#table-of-contents)

## Data and Validation Scripts
### `scripts/env-check.sh`
- Loads `~/.config/poi-stack/poi.env` and validates required keys.
- Prints `[OK]`/`[MISSING]` per variable.
- Exits non-zero when mandatory settings are missing.

### `scripts/migrate.sh`
- Applies every SQL file from `db/migrations/` inside `poi-db` container.
- Intended for schema updates after deployment.

### `scripts/backup.sh`
- Runs `mariadb-dump` in `poi-db` container.
- Writes UTC timestamped dumps to `~/.config/poi-stack/backups/`.

### `scripts/restore.sh`
- Restores an SQL dump into configured database.
- Requires explicit dump path argument.
- Destructive to current DB state; use carefully.

### `scripts/reset-dev.sh`
- Development-only reset path: stop services, remove DB volume, start services.
- Useful for local clean-slate testing.

[Go to TOC](#table-of-contents)

## Testing and Scheduling Scripts
### `scripts/test-integration.sh`
- End-to-end API test covering:
  - health and readiness
  - login and refresh token flow
  - POI create/search
  - photo upload and archive/restore
  - POI archive/restore
  - radius query
- Uses temporary files and exits with non-zero on any failed assertion.

### `scripts/test-nightly.sh`
- Wrapper used by nightly systemd service/timer.
- Writes test output to `~/.config/poi-stack/logs/integration_<timestamp>.log`.
- Updates symlink `integration_latest.log`.
- Retains most recent N logs with `NIGHTLY_LOG_RETAIN_COUNT` (default `14`).

[Go to TOC](#table-of-contents)

## Environment Variables Used by Scripts
- Core paths and settings: `STACK_ENV_FILE` (resolved from `~/.config/poi-stack/poi.env`).
- DB settings: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- MariaDB bootstrap vars: `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`.
- Auth: `ADMIN_USER`, `ADMIN_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`.
- API/runtime limits: `UPLOAD_MAX_BYTES`, `PHOTO_MAX_PER_POI`, `CORS_ORIGIN`.
- OSM config: `OSM_TILE_URL`, `OSM_ATTRIBUTION`.
- Docs auth: `DOCS_AUTH_ENABLED`, `DOCS_AUTH_USER`, `DOCS_AUTH_PASS`.
- Nightly logs: `NIGHTLY_LOG_RETAIN_COUNT`.

[Go to TOC](#table-of-contents)

## Recommended Operator Workflow
1. Configure env: `cp .env.example ~/.config/poi-stack/poi.env`.
2. Validate env: `./scripts/env-check.sh`.
3. Build images: `./scripts/build.sh`.
4. Install/start stack: `./scripts/install.sh`.
5. Verify stack: `./scripts/health.sh` and `./scripts/status.sh`.
6. Run functional validation: `./scripts/test-integration.sh`.
7. Monitor timers: `systemctl --user list-timers | grep poi-`.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
