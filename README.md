[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# OSM POI Platform (Podman + MariaDB)

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Included App Stack](#included-app-stack)
- [Quick Start](#quick-start)
- [Repository Layout](#repository-layout)
- [Operations](#operations)
- [Operational Checklist](#operational-checklist)
- [Documentation Index](#documentation-index)

## Overview
This project provides an OpenStreetMap-based Point of Interest platform with
descriptions and photos stored in MariaDB.  It uses rootless Podman with
systemd Quadlet units; all containers run inside a single pod so no custom
network is required.

[Go to TOC](#table-of-contents)

## Architecture

All five containers run inside the **`poi` Podman pod**.  Inside a pod,
containers share one network namespace and communicate over `127.0.0.1`.  The
pod exposes a single host port; Caddy routes all inbound traffic.

| Service | Role | Internal port |
|---|---|---|
| `poi-proxy` | Caddy reverse proxy — single entry point at `http://localhost:9010` | 9010 (published) |
| `poi-web` | Next.js map UI and POI workflows | 3000 |
| `poi-api` | Bun/Elysia OpenAPI-first API with JWT write protection | 3001 |
| `poi-db` | MariaDB with spatial location data and photo BLOB storage | 3306 |
| `poi-phpmyadmin` | phpMyAdmin database admin UI at `/phpmyadmin/` | 80 |

Inter-container routing in Caddy uses `127.0.0.1:<port>` — not DNS names —
because all containers share the pod's loopback interface.

Quadlet units live in `infra/quadlet/` as `.pod`, `.container`, and `.volume`
files.  `install.sh` substitutes the `__PROJECT_ROOT__` placeholder and copies
them to `~/.config/containers/systemd/` before reloading the daemon.

[Go to TOC](#table-of-contents)

## Included App Stack
- `api/` — Bun + Elysia API with JWT access+refresh token flow, spatial search, and archive/restore routes
- `web/` — Next.js map UI using Leaflet + OpenStreetMap tiles
- `containers/` — Podman build definitions (Containerfiles) for API, web, and Caddy proxy
- `containers/phpmyadmin/` — phpMyAdmin config and patched `Header.php` (PHP 5.2.3 rootPath fix)
- `db/migrations/` — sequential SQL schema migration files
- `infra/quadlet/` — Quadlet pod, container, and volume unit definitions
- `infra/systemd/` — auxiliary systemd service and timer units (backup, nightly integration)

[Go to TOC](#table-of-contents)

## Quick Start
1. Copy the environment template and set **all** secrets (no `change_me_*` placeholders allowed):
   ```bash
   mkdir -p .runtime
   cp .env.example .runtime/poi.env
   # Generate real values — example for each secret type:
   #   openssl rand -hex 24   → MARIADB_PASSWORD, MARIADB_ROOT_PASSWORD
   #   openssl rand -hex 32   → JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
   #   openssl rand -hex 16   → ADMIN_PASSWORD, DOCS_AUTH_PASS
   # Edit .runtime/poi.env and replace every change_me_* with generated values.
   # See docs/INSTALL.md § Configure Environment for the full table.
   ./scripts/env-check.sh   # must show [OK] for every variable
   ```
2. Build local container images:
   ```bash
   ./scripts/build.sh
   ```
3. Install Quadlet units and start services:
   ```bash
   ./scripts/install.sh
   ```
4. Verify the stack is healthy:
   ```bash
   ./scripts/health.sh
   ```

[Go to TOC](#table-of-contents)

## Repository Layout

```
.env.example              required environment variable template
.runtime/                 runtime secrets and output (gitignored)
  poi.env                 environment file loaded by all containers
  backups/                nightly SQL dumps
  logs/                   nightly integration test logs
api/                      Bun/Elysia API source
web/                      Next.js frontend source
containers/
  api/Containerfile       API image build definition
  web/Containerfile       web image build definition
  proxy/
    Containerfile         Caddy image build definition
    Caddyfile             reverse proxy routing rules
  phpmyadmin/
    Header.php            patched phpMyAdmin header (rootPath bug fix)
    phpmyadmin.conf       Apache alias config for /phpmyadmin subpath
db/
  migrations/             sequential *.sql schema migration files
infra/
  quadlet/
    poi.pod               Podman pod unit (owns PublishPort=127.0.0.1:9010:9010)
    poi-db.container      MariaDB container unit
    poi-api.container     API container unit
    poi-web.container     Next.js container unit
    poi-proxy.container   Caddy container unit
    poi-phpmyadmin.container  phpMyAdmin container unit
    poi-db.volume         named volume for MariaDB data
  systemd/
    poi-backup.*          nightly backup service + timer
    poi-integration.*     nightly integration test service + timer
scripts/                  lifecycle and ops automation (see docs/SCRIPTS.md)
docs/                     operations, security, API, and troubleshooting guides
```

[Go to TOC](#table-of-contents)

## Operations

| Task | Command |
|---|---|
| Start | `./scripts/start.sh` |
| Stop | `./scripts/stop.sh` |
| Restart | `./scripts/restart.sh` |
| Rebuild images + restart | `./scripts/rebuild.sh` |
| Run pending DB migrations | `./scripts/migrate.sh` |
| Check health endpoints | `./scripts/health.sh` |
| Show service + container status | `./scripts/status.sh` |
| Tail service logs | `./scripts/logs.sh [db\|api\|web\|proxy\|phpmyadmin]` |
| Create a DB backup | `./scripts/backup.sh` |
| Restore a DB backup | `./scripts/restore.sh /path/to/dump.sql` |
| Run integration tests | `./scripts/test-integration.sh` |
| Validate environment config | `./scripts/env-check.sh` |

[Go to TOC](#table-of-contents)

## Operational Checklist
1. Validate runtime config: `./scripts/env-check.sh`.
2. Confirm service health: `./scripts/health.sh`.
3. Review services and timers: `./scripts/status.sh`.
4. Run integration suite before/after major changes: `./scripts/test-integration.sh`.
5. Confirm scheduled jobs: `systemctl --user list-timers | grep poi-`.

[Go to TOC](#table-of-contents)

## Documentation Index

| Document | Contents |
|---|---|
| `docs/INSTALL.md` | Prerequisites, pod architecture, step-by-step install |
| `docs/OPERATIONS.md` | Lifecycle, logs, migrations, timers, incident response |
| `docs/SCRIPTS.md` | Full script reference — what each script does and why it exists |
| `docs/BACKUP_RESTORE.md` | Backup strategy, retention, and restore procedure |
| `docs/TROUBLESHOOTING.md` | Common failure modes including pod networking and 502 fixes |
| `docs/SECURITY.md` | JWT auth, CORS, docs auth, secret management |
| `docs/API.md` | API endpoint summary and authentication flow |
| `docs/README.md` | Documentation index |
| `docs/LICENSE.md` | License details |

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
