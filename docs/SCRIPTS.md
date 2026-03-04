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
This document describes every `*.sh` script in the project: what it does, **why it exists**, when to run it, and important safety notes.

All scripts use `set -euo pipefail` and source `common.sh` for shared paths, service lists, and helper functions.  They are designed to be run from the project root directory.

[Go to TOC](#table-of-contents)

## Script Catalog

| Script | Why it exists | Typical usage |
|---|---|---|
| `scripts/common.sh` | Single source of truth for paths, service lists, and helper functions shared by all other scripts | Sourced automatically — never run directly |
| `scripts/install.sh` | Handles first-time unit installation, daemon reload, migrations, and timer activation in one command | `./scripts/install.sh` |
| `scripts/uninstall.sh` | Cleanly removes all unit files and optionally purges the DB volume without leaving orphan systemd units | `./scripts/uninstall.sh` |
| `scripts/build.sh` | Builds the locally-tagged Podman images that Quadlet units reference | `./scripts/build.sh` |
| `scripts/rebuild.sh` | Combines stop → build → start → status for the common "I changed code, redeploy everything" workflow | `./scripts/rebuild.sh` |
| `scripts/start.sh` | Starts services in safe dependency order (DB → wait → migrate → app tier) | `./scripts/start.sh` |
| `scripts/stop.sh` | Stops all stack services using the canonical service list to avoid missing any | `./scripts/stop.sh` |
| `scripts/restart.sh` | Restarts services through stop + start so the DB-wait and migration steps always run | `./scripts/restart.sh` |
| `scripts/status.sh` | Shows service state, timer state, and running containers at a glance | `./scripts/status.sh` |
| `scripts/logs.sh` | Wraps journalctl so operators tail a service log by short name instead of full unit name | `./scripts/logs.sh api` |
| `scripts/health.sh` | HTTP smoke-test against all live endpoints — safe to use as a post-deploy gate | `./scripts/health.sh` |
| `scripts/migrate.sh` | Applies pending SQL migration files idempotently; skips already-recorded migrations | `./scripts/migrate.sh` |
| `scripts/env-check.sh` | Validates all required env keys before any container starts, catching config errors early | `./scripts/env-check.sh` |
| `scripts/backup.sh` | Creates a timestamped SQL dump and prunes old backups to stay within the retention limit | `./scripts/backup.sh` |
| `scripts/restore.sh` | Stops the application tier, restores a SQL dump, and brings services back up atomically | `./scripts/restore.sh /path/to/file.sql` |
| `scripts/reset-dev.sh` | Wipes the DB volume for a clean-slate local dev reset — not for production | `./scripts/reset-dev.sh` |
| `scripts/test-integration.sh` | End-to-end API validation covering auth, CRUD, photo, archive/restore, and radius search | `./scripts/test-integration.sh` |
| `scripts/test-nightly.sh` | Nightly wrapper around the integration suite with timestamped log files and retention | `./scripts/test-nightly.sh` |
| `scripts/phpmyadmin.sh` | Convenience entry point to start the phpMyAdmin container when it has been stopped manually | `./scripts/phpmyadmin.sh` |

[Go to TOC](#table-of-contents)

## Bootstrap and Shared Utilities

### `scripts/common.sh`
**Why it exists:** Every script needs the same resolved paths, the same list of managed services, and the same helper functions.  Centralising them here prevents silent drift when a service or directory is added.

- Resolves `PROJECT_ROOT`, `USER_QUADLET_DIR`, `USER_SYSTEMD_DIR`, `BACKUP_DIR`, and `LOG_DIR` relative to the script's own location — so paths are always correct regardless of where the operator invokes the script from.
- Declares `STACK_SERVICES` (the five core container units) and `STACK_AUX_UNITS` (backup and integration timers).  All lifecycle scripts iterate these arrays so they stay consistent automatically.
- Provides helper functions: `log`, `warn`, `die`, `require_cmd`, `require_user_systemd`, `ensure_dirs`, `ensure_env_file`, `load_env_file`, `wait_for_db`.
- `wait_for_db` polls `mariadb-admin ping` inside `poi-db` with a configurable timeout (default 90 s) so callers do not need to guess how long the DB takes to be ready.

### `scripts/install.sh`
**Why it exists:** Podman Quadlet units must be copied to `~/.config/containers/systemd/` with the `__PROJECT_ROOT__` placeholder substituted before systemd can use them.  A one-command install flow removes the chance of copy-paste errors.

- Validates prerequisites: `podman`, `systemctl`, `python`, user systemd session.
- Creates runtime directories and bootstraps `.runtime/poi.env` from `.env.example` if missing.
- Runs `env-check.sh` to fail fast on missing configuration.
- Substitutes `__PROJECT_ROOT__` in every `.container` file using Python's `pathlib`; copies `.pod` and `.volume` files directly.
- Reloads the user systemd daemon and enables all stack services.
- Starts `poi-db`, waits for readiness, runs `migrate.sh`, then starts the remaining four services.
- Enables and starts `poi-backup.timer` and `poi-integration.timer`.

### `scripts/uninstall.sh`
**Why it exists:** Leaving orphan unit files in `~/.config/containers/systemd/` causes systemd daemon-reload warnings and can prevent future installs from working cleanly.

- Stops and disables all stack services and auxiliary units.
- Removes all installed unit files from the user Quadlet and systemd directories.
- With `--purge-data`: also removes the `poi-db-data` volume (irreversible — back up first).
- Without `--purge-data`: keeps the DB volume intact so data survives a reinstall.

[Go to TOC](#table-of-contents)

## Build and Lifecycle Scripts

### `scripts/build.sh`
**Why it exists:** Quadlet units reference locally-built images (`localhost/poi-api:latest` etc.) that are not on any public registry and must be rebuilt from source after every code change.

- Builds `localhost/poi-api:latest`, `localhost/poi-web:latest`, and `localhost/poi-proxy:latest`.
- Uses the project root as the build context so both `api/` and `web/` source trees are available inside the container build.
- Skips an image with a warning if its `Containerfile` is missing, making it safe to run even in a partial checkout.
- The proxy image includes the Caddyfile at build time; rebuild the proxy image after Caddyfile changes.

### `scripts/rebuild.sh`
**Why it exists:** The most common development operation is "I changed code, rebuild and restart everything".  Encoding the four-step sequence (stop → build → start → status) in one script prevents operators from forgetting a step.

- Calls `stop.sh`, `build.sh`, `start.sh`, and `status.sh` in order.
- Preferred after changes to `api/`, `web/`, or `containers/`.
- For config-only changes that don't need a new image use `restart.sh` instead.

### `scripts/start.sh`
**Why it exists:** The database must be ready and migrations applied before any application container starts accepting traffic.  Systemd dependency ordering alone cannot enforce the DB-readiness wait.

- Starts `poi-db.service` and waits up to 90 s for MariaDB to accept connections.
- Runs `migrate.sh` to apply any pending SQL files.
- Starts `poi-api.service`, `poi-web.service`, `poi-proxy.service`, and `poi-phpmyadmin.service`.
- Prints the final status table.

### `scripts/stop.sh`
**Why it exists:** Iterating the canonical `STACK_SERVICES` array ensures every service is stopped — even if a new service was added and the operator forgot to stop it manually.

- Stops all five stack services; ignores already-stopped units (`|| true`).
- Does not disable services, remove units, or touch timers.

### `scripts/restart.sh`
**Why it exists:** A plain `systemctl restart` skips the DB-readiness wait and migration step.  This script guarantees the same safe sequence as a fresh start.

- Calls `stop.sh` then `start.sh`; prints the resulting status.
- Use for config changes (env file edits) where images have not changed.

### `scripts/status.sh`
**Why it exists:** Provides an at-a-glance snapshot of the entire stack — service states, timer states, and live container port mappings — in one table.

- Iterates `STACK_SERVICES` and `STACK_AUX_UNITS` and prints `is-active` state.
- Runs `podman ps` to show all running containers and their published ports.
- Called automatically at the end of install, rebuild, and restart.

### `scripts/logs.sh`
**Why it exists:** Reduces the cognitive load of tailing container logs — the operator types the short service name instead of the full journald unit name.

- Accepts one argument: `db`, `api`, `web`, `proxy`, or `phpmyadmin`.
- Translates it to `poi-<name>.service` and execs `journalctl --user -f`.
- Rejects unknown targets and prints the valid list.

### `scripts/health.sh`
**Why it exists:** After a deploy the operator needs fast confirmation that every externally-facing endpoint is healthy.  Fails fast on the first bad response so it can be used as a deploy gate.

- Tests `GET /health`, `GET /ready`, `GET /openapi.json`, and `GET /docs` against `BASE_URL` (default `http://localhost:9010`).
- Treats 2xx and 3xx as healthy.
- Treats `401` on docs routes as healthy when `DOCS_AUTH_ENABLED=true`.
- Prints `[OK]` or `[FAIL]` per endpoint and exits non-zero on any failure.

### `scripts/phpmyadmin.sh`
**Why it exists:** phpMyAdmin is part of the poi pod but is an optional management tool that operators may want to start or restart independently without touching the rest of the stack.

- Starts `poi-phpmyadmin.service` via `systemctl --user`.
- phpMyAdmin is accessible at `http://localhost:9010/phpmyadmin/`.
- Log in with the MariaDB user credentials from `.runtime/poi.env`.
- Under normal operation the service starts automatically with `start.sh`; this script is only needed if it was stopped manually.

[Go to TOC](#table-of-contents)

## Data and Validation Scripts

### `scripts/env-check.sh`
**Why it exists:** Missing environment variables cause cryptic failures deep inside running containers.  Checking them before any service starts provides a clear error message and a fast feedback loop.

- Loads `.runtime/poi.env` and checks every required key.
- Prints `[OK]` or `[MISSING]` per variable.
- Exits non-zero if any are absent, blocking `install.sh` from proceeding.

### `scripts/migrate.sh`
**Why it exists:** Schema changes must be applied in a controlled, idempotent way.  Tracking applied migrations in a `schema_migrations` table means the script can be run on every start without re-applying anything.

- Creates the `schema_migrations` tracking table if it does not exist.
- Iterates every `*.sql` file in `db/migrations/` in filename order.
- Applies a file and records it only if it has not been recorded before.
- Requires `poi-db` to be running; called automatically by `start.sh`.

### `scripts/backup.sh`
**Why it exists:** The archive-only data lifecycle means no records are deleted from the DB, but disk corruption, accidental schema drops, or restore-to-staging scenarios still require point-in-time SQL dumps.

- Runs `mariadb-dump --single-transaction` inside the `poi-db` container (no table locks).
- Writes to `.runtime/backups/poi_<UTC-timestamp>.sql`.
- Retains the most recent `BACKUP_RETAIN_COUNT` files (default `30`); older files are deleted automatically.
- Scheduled nightly at 02:15 via `poi-backup.timer`.

### `scripts/restore.sh`
**Why it exists:** Restoring a dump while the API is running risks serving partial or inconsistent data.  This script stops the application tier first, performs the restore, and then brings services back up.

- Takes one required argument: path to the `.sql` dump file.
- Stops `poi-api.service`, `poi-web.service`, and `poi-proxy.service`.
- Streams the dump into MariaDB via `podman exec -i`.
- Restarts the application services after the restore completes.
- **Destructive** — overwrites all current DB content.  Always run `backup.sh` first.

### `scripts/reset-dev.sh`
**Why it exists:** Starting with an empty database is a common local development need (testing migrations from scratch, seeding fixture data).  Removing a named Podman volume manually requires stopping services in the right order first.

- Calls `stop.sh`, removes the `poi-db-data` volume, then calls `start.sh`.
- Migrations are re-applied from scratch by `start.sh`.
- **Not for production use.**

[Go to TOC](#table-of-contents)

## Testing and Scheduling Scripts

### `scripts/test-integration.sh`
**Why it exists:** Unit tests cannot detect routing bugs, auth misconfiguration, or database wiring problems that only appear when the full stack is running.  This script validates the critical user journeys end-to-end against the live stack.

Covers:
- Health and readiness endpoints
- Login and access token issuance
- Refresh token flow
- POI creation and search
- Photo upload
- Photo archive and restore
- POI archive and restore
- Radius (geospatial) query

- Uses a temporary directory for response files; cleans up on exit.
- Fails immediately with `[FAIL]` on any unexpected response or missing field.
- Refuses to run if `ADMIN_PASSWORD` is still the placeholder value.
- All test data is created within the run and archived afterward; no manual cleanup required.

### `scripts/test-nightly.sh`
**Why it exists:** Automated nightly runs catch regressions that occur between manual deploys.  This wrapper adds log management so the history of nightly runs is preserved and searchable.

- Wraps `test-integration.sh` and writes output to `.runtime/logs/integration_<UTC-timestamp>.log`.
- Updates the symlink `.runtime/logs/integration_latest.log` to the newest file.
- Retains the most recent `NIGHTLY_LOG_RETAIN_COUNT` log files (default `14`).
- Invoked by `poi-integration.timer` at 02:45 daily.
- Run manually to test the pipeline: `systemctl --user start poi-integration.service`.

[Go to TOC](#table-of-contents)

## Environment Variables Used by Scripts

| Variable | Used by |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `migrate.sh`, `backup.sh`, `restore.sh`, `common.sh` (wait_for_db) |
| `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD` | MariaDB container bootstrap (validated by `env-check.sh`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` | API auth (validated by `env-check.sh`) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | `test-integration.sh` login test |
| `CORS_ORIGIN` | API CORS policy |
| `UPLOAD_MAX_BYTES`, `PHOTO_MAX_PER_POI` | API upload limits |
| `OSM_TILE_URL`, `OSM_ATTRIBUTION` | Web map tile source |
| `DOCS_AUTH_ENABLED`, `DOCS_AUTH_USER`, `DOCS_AUTH_PASS` | Swagger docs basic auth |
| `BACKUP_RETAIN_COUNT` | `backup.sh` retention limit (default `30`) |
| `NIGHTLY_LOG_RETAIN_COUNT` | `test-nightly.sh` log retention (default `14`) |
| `PMA_HOST`, `PMA_PORT`, `PMA_ABSOLUTE_URI` | phpMyAdmin container configuration |
| `BASE_URL` | `health.sh` and `test-integration.sh` base URL override |

[Go to TOC](#table-of-contents)

## Recommended Operator Workflow

### First install
```bash
cp .env.example .runtime/poi.env   # copy template
# edit .runtime/poi.env — set all secrets and passwords
./scripts/build.sh                 # build Podman images
./scripts/install.sh               # install units, run migrations, start stack
./scripts/health.sh                # confirm all endpoints healthy
./scripts/test-integration.sh      # run full functional validation
```

### After a code change
```bash
./scripts/rebuild.sh               # stop → rebuild images → start → status
./scripts/health.sh                # confirm healthy
```

### After a config-only change (env file, no new image)
```bash
./scripts/restart.sh               # stop → start → status
```

### Adding a new migration
```bash
# add db/migrations/NNNN_description.sql
./scripts/migrate.sh               # apply immediately (DB must be running)
```

### Monitoring
```bash
./scripts/status.sh                          # service + container state
./scripts/logs.sh api                        # tail API logs
./scripts/logs.sh proxy                      # tail Caddy access/error logs
systemctl --user list-timers | grep poi-     # check scheduled jobs
cat .runtime/logs/integration_latest.log     # last nightly test result
```

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
