[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Operations Guide

## Table of Contents
- [Service Lifecycle](#service-lifecycle)
- [Logs](#logs)
- [Health and Readiness](#health-and-readiness)
- [phpMyAdmin](#phpmyadmin)
- [Database Migrations](#database-migrations)
- [Integration Test Suite](#integration-test-suite)
- [Nightly Integration Timer](#nightly-integration-timer)
- [Backup Timer](#backup-timer)
- [Incident Response Quick Steps](#incident-response-quick-steps)
- [Rebuild Workflow](#rebuild-workflow)
- [Uninstall](#uninstall)

## Service Lifecycle

All five containers run inside the **`poi` Podman pod**. They share a network
namespace, so inter-container traffic uses `127.0.0.1` and the port of the
target service. The pod publishes only one host port (`127.0.0.1:9010`);
Caddy is the single entry point that routes traffic internally.

| Service | Container | Internal port |
|---|---|---|
| `poi-db.service` | MariaDB | 3306 |
| `poi-api.service` | Bun/Elysia API | 3001 |
| `poi-web.service` | Next.js | 3000 |
| `poi-proxy.service` | Caddy | 9010 (published) |
| `poi-phpmyadmin.service` | phpMyAdmin | 80 |

- Start: `./scripts/start.sh`
- Stop: `./scripts/stop.sh`
- Restart: `./scripts/restart.sh`
- Status: `./scripts/status.sh`

[Go to TOC](#table-of-contents)

## Logs

Tail a service log by its short name:

```bash
./scripts/logs.sh db
./scripts/logs.sh api
./scripts/logs.sh web
./scripts/logs.sh proxy
./scripts/logs.sh phpmyadmin
```

Or query journald directly:

```bash
journalctl --user -u poi-api.service -n 100 --no-pager
```

Nightly integration run logs:

```bash
cat .runtime/logs/integration_latest.log
ls  .runtime/logs/
```

[Go to TOC](#table-of-contents)

## Health and Readiness

Run:

```bash
./scripts/health.sh
```

The script checks `/health`, `/ready`, `/openapi.json`, and `/docs` on
`http://localhost:9010`.  If `DOCS_AUTH_ENABLED=true`, a `401` response on the
docs routes is treated as healthy.

[Go to TOC](#table-of-contents)

## phpMyAdmin

phpMyAdmin is accessible at:

```
http://localhost:9010/phpmyadmin/
```

- Log in with the `MARIADB_USER` / `MARIADB_PASSWORD` values from `.runtime/poi.env`.
- The service starts automatically with the stack via `start.sh`.
- If it was stopped manually, restart it with:

```bash
./scripts/phpmyadmin.sh
# or directly:
systemctl --user start poi-phpmyadmin.service
```

- Tail phpMyAdmin logs:

```bash
./scripts/logs.sh phpmyadmin
```

[Go to TOC](#table-of-contents)

## Database Migrations

Run:

```bash
./scripts/migrate.sh
```

This applies each SQL file in `db/migrations/` (in filename order) to the
running `poi-db` container.  Already-applied migrations are skipped; the
tracking table `schema_migrations` records each applied filename.

`migrate.sh` is called automatically by `start.sh` and `install.sh`.

[Go to TOC](#table-of-contents)

## Integration Test Suite

Run:

```bash
./scripts/test-integration.sh
```

Validates login, token refresh, POI CRUD, photo upload, archive/restore flows,
and radius search against the live stack.  All test data is created and archived
within the run; no manual cleanup is needed.

[Go to TOC](#table-of-contents)

## Nightly Integration Timer

The install process deploys and enables:
- `poi-integration.service`
- `poi-integration.timer`

Timer schedule:
- `OnCalendar=*-*-* 02:45:00`
- `Persistent=true`

Manual trigger and log inspection:

```bash
systemctl --user start poi-integration.service
cat .runtime/logs/integration_latest.log
```

Log files are written to `.runtime/logs/integration_*.log` and the latest is
symlinked as `integration_latest.log`.  Retention defaults to 14 files and can
be changed with `NIGHTLY_LOG_RETAIN_COUNT`.

[Go to TOC](#table-of-contents)

## Backup Timer

The install process deploys and enables:
- `poi-backup.service`
- `poi-backup.timer`

Timer schedule:
- `OnCalendar=*-*-* 02:15:00`
- `Persistent=true`

Dump files are written to `.runtime/backups/poi_<UTC-timestamp>.sql`.
Retention defaults to 30 files and can be changed with `BACKUP_RETAIN_COUNT`.

Check timer status:

```bash
systemctl --user status poi-backup.timer
systemctl --user list-timers | grep poi-backup
```

Manual backup:

```bash
./scripts/backup.sh
```

[Go to TOC](#table-of-contents)

## Incident Response Quick Steps

1. Snapshot status: `./scripts/status.sh`.
2. Check endpoint health: `./scripts/health.sh`.
3. Tail the failing service: `./scripts/logs.sh api` or `./scripts/logs.sh proxy`.
4. Re-run integration checks to scope impact: `./scripts/test-integration.sh`.
5. If schema drift suspected, apply pending migrations: `./scripts/migrate.sh`.
6. If data corruption suspected, take an immediate backup: `./scripts/backup.sh`.
7. If restore is needed: `./scripts/restore.sh .runtime/backups/<file>.sql`.

[Go to TOC](#table-of-contents)

## Rebuild Workflow

Use after code or image changes:

```bash
./scripts/rebuild.sh
```

This runs stop → build → start → status in sequence.  For a config-only change
(env file, no new image) use `./scripts/restart.sh` instead.

[Go to TOC](#table-of-contents)

## Uninstall

Full destructive uninstall (keeps the repo checkout only):

```bash
./scripts/uninstall.sh
```

Compatibility alias (same destructive result):

```bash
./scripts/uninstall.sh --purge-data
```

This removes POI user units, the `poi` pod, leftover POI containers,
`localhost/poi-*` images, the `poi-db-data` volume, and repo-local generated
artifacts such as `.runtime/` and `web/.next/`.  The repository checkout stays
on disk.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
