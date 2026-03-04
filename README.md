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
This project provides an OpenStreetMap-based Point of Interest platform with descriptions and photos stored in MariaDB. It uses rootless Podman and systemd user services with Quadlet units.

[Go to TOC](#table-of-contents)

## Architecture
- `proxy`: reverse proxy on `http://localhost:9010`
- `web`: map UI and POI workflows
- `api`: OpenAPI-first API with JWT write protection
- `db`: MariaDB with spatial location data and photo BLOB storage
- `infra/quadlet`: rootless Podman systemd unit definitions

[Go to TOC](#table-of-contents)

## Included App Stack
- `api/`: Bun + Elysia API with JWT access+refresh token flow, spatial search, and archive/restore routes
- `web/`: Next.js map UI using Leaflet + OpenStreetMap tiles
- `containers/`: Podman build definitions for API, web, and Caddy proxy
- `db/migrations/`: SQL schema migration files

[Go to TOC](#table-of-contents)

## Quick Start
1. Copy and edit env values:
   - `cp .env.example ~/.config/poi-stack/poi.env`
2. Build local images:
   - `./scripts/build.sh`
3. Install and start services:
   - `./scripts/install.sh`
4. Verify:
   - `./scripts/health.sh`

[Go to TOC](#table-of-contents)

## Repository Layout
- `scripts/` lifecycle and ops automation
- `infra/quadlet/` Quadlet units (`.container`, `.network`, `.volume`)
- `docs/` operations, security, API, and troubleshooting guides
- `.env.example` required environment variable template

[Go to TOC](#table-of-contents)

## Operations
- Start: `./scripts/start.sh`
- Stop: `./scripts/stop.sh`
- Restart: `./scripts/restart.sh`
- Rebuild: `./scripts/rebuild.sh`
- Migrate: `./scripts/migrate.sh`
- Integration tests: `./scripts/test-integration.sh`
- Nightly test runner: `./scripts/test-nightly.sh`
- Logs: `./scripts/logs.sh api`
- Backup: `./scripts/backup.sh`
- Restore: `./scripts/restore.sh /path/to/dump.sql`

[Go to TOC](#table-of-contents)

## Operational Checklist
1. Validate runtime config: `./scripts/env-check.sh`.
2. Confirm service health: `./scripts/health.sh`.
3. Review services and timers: `./scripts/status.sh`.
4. Run integration suite before/after major changes: `./scripts/test-integration.sh`.
5. Confirm scheduled jobs: `systemctl --user list-timers | grep poi-`.

[Go to TOC](#table-of-contents)

## Documentation Index
- `docs/README.md`
- `docs/INSTALL.md`
- `docs/OPERATIONS.md`
- `docs/SCRIPTS.md`
- `docs/BACKUP_RESTORE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/SECURITY.md`
- `docs/API.md`
- `docs/LICENSE.md`

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
