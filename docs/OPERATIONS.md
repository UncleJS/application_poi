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
- [Database Migrations](#database-migrations)
- [Integration Test Suite](#integration-test-suite)
- [Nightly Integration Timer](#nightly-integration-timer)
- [Backup Timer](#backup-timer)
- [Incident Response Quick Steps](#incident-response-quick-steps)
- [Rebuild Workflow](#rebuild-workflow)
- [Uninstall](#uninstall)

## Service Lifecycle
- Start: `./scripts/start.sh`
- Stop: `./scripts/stop.sh`
- Restart: `./scripts/restart.sh`
- Status: `./scripts/status.sh`

[Go to TOC](#table-of-contents)

## Logs
- API logs: `./scripts/logs.sh api`
- Web logs: `./scripts/logs.sh web`
- DB logs: `./scripts/logs.sh db`
- Proxy logs: `./scripts/logs.sh proxy`
- Nightly integration run logs: `~/.config/poi-stack/logs/integration_latest.log`

[Go to TOC](#table-of-contents)

## Health and Readiness
Run:

```bash
./scripts/health.sh
```

The script checks `/health`, `/ready`, `/openapi.json`, and `/docs` on `http://localhost:9010`.
If docs auth is enabled (`DOCS_AUTH_ENABLED=true`), `401` is treated as healthy for docs endpoints.

[Go to TOC](#table-of-contents)

## Database Migrations
Run:

```bash
./scripts/migrate.sh
```

This applies each SQL file in `db/migrations/` to the running `poi-db` container.

[Go to TOC](#table-of-contents)

## Integration Test Suite
Run:

```bash
./scripts/test-integration.sh
```

This validates login, refresh, POI CRUD, photo upload, archive/restore flows, and radius search.

[Go to TOC](#table-of-contents)

## Nightly Integration Timer
The install process deploys and enables:
- `poi-integration.service`
- `poi-integration.timer`

Timer schedule:
- `OnCalendar=*-*-* 02:45:00`
- `Persistent=true`

Manual run and logs:

```bash
systemctl --user start poi-integration.service
ls ~/.config/poi-stack/logs
```

The test log file is written to `~/.config/poi-stack/logs/integration_*.log` and symlinked as `integration_latest.log`.
Log retention defaults to 14 files and can be overridden with `NIGHTLY_LOG_RETAIN_COUNT`.

[Go to TOC](#table-of-contents)

## Backup Timer
The install process deploys and enables:
- `poi-backup.service`
- `poi-backup.timer`

Timer schedule:
- `OnCalendar=*-*-* 02:15:00`
- `Persistent=true`

Check timer status:

```bash
systemctl --user status poi-backup.timer
systemctl --user list-timers | grep poi-backup
```

[Go to TOC](#table-of-contents)

## Incident Response Quick Steps
1. Snapshot status: `./scripts/status.sh`.
2. Check endpoint health: `./scripts/health.sh`.
3. Tail failing service logs: `./scripts/logs.sh api` or `./scripts/logs.sh proxy`.
4. Re-run integration checks to scope impact: `./scripts/test-integration.sh`.
5. If schema drift suspected, apply SQL updates: `./scripts/migrate.sh`.
6. If data corruption suspected, take immediate backup: `./scripts/backup.sh`.

[Go to TOC](#table-of-contents)

## Rebuild Workflow
Use this after code or image changes:

```bash
./scripts/rebuild.sh
```

This runs stop, build, start, and status in sequence.

[Go to TOC](#table-of-contents)

## Uninstall
Standard uninstall:

```bash
./scripts/uninstall.sh
```

Uninstall and purge persistent DB volume:

```bash
./scripts/uninstall.sh --purge-data
```

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
