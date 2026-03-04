[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Installation Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Required Local Paths](#required-local-paths)
- [Configure Environment](#configure-environment)
- [Build Local Images](#build-local-images)
- [Install Services](#install-services)
- [Verify Installation](#verify-installation)
- [First Login and Smoke Test](#first-login-and-smoke-test)
- [phpMyAdmin Access](#phpmyadmin-access)
- [Optional Docs Authentication](#optional-docs-authentication)

## Prerequisites
- Linux user session with `systemd --user`
- `podman` >= 4.4 (Quadlet support required)
- `systemctl` available
- `curl` available for health checks
- `python` available for install and integration scripts

[Go to TOC](#table-of-contents)

## Architecture Overview

All containers run inside a single **Podman pod** (`poi`).  Inside a pod,
containers share one network namespace — they communicate over `127.0.0.1`
using each other's port numbers.  The pod publishes one host port:

```
host: 127.0.0.1:9010  →  poi-proxy (Caddy) :9010
```

Caddy routes internal traffic:

| Path prefix | Upstream |
|---|---|
| `/health`, `/api/*`, `/docs`, `/openapi.json`, `/auth/*` | `127.0.0.1:3001` (API) |
| `/phpmyadmin*` | `127.0.0.1:80` (phpMyAdmin) |
| everything else | `127.0.0.1:3000` (Next.js web) |

Container units are managed by **Quadlet** — `.container` and `.pod` files in
`infra/quadlet/` that systemd reads after `daemon-reload`.  The
`__PROJECT_ROOT__` placeholder in `.container` files is substituted with the
real project path during install.

[Go to TOC](#table-of-contents)

## Required Local Paths

| Path | Purpose |
|---|---|
| `.runtime/poi.env` | Runtime secrets and configuration (gitignored) |
| `.runtime/backups/` | SQL dump output directory |
| `.runtime/logs/` | Nightly integration test logs |
| `~/.config/containers/systemd/` | Quadlet unit install location |
| `~/.config/systemd/user/` | Auxiliary systemd unit install location |

[Go to TOC](#table-of-contents)

## Configure Environment

1. Create the runtime directory and copy the template:

```bash
mkdir -p .runtime
cp .env.example .runtime/poi.env
```

2. Edit `.runtime/poi.env` and set all secrets:
   - `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `ADMIN_USER`, `ADMIN_PASSWORD`
   - `CORS_ORIGIN` — set to the host/port where the UI is served
   - `DOCS_AUTH_ENABLED`, `DOCS_AUTH_USER`, `DOCS_AUTH_PASS` (optional)

3. Validate the config:

```bash
./scripts/env-check.sh
```

[Go to TOC](#table-of-contents)

## Build Local Images

```bash
./scripts/build.sh
```

Builds three locally-tagged images used by the Quadlet units:
- `localhost/poi-api:latest` — Bun/Elysia API
- `localhost/poi-web:latest` — Next.js frontend
- `localhost/poi-proxy:latest` — Caddy reverse proxy

[Go to TOC](#table-of-contents)

## Install Services

```bash
./scripts/install.sh
```

This single command:
1. Validates prerequisites and environment variables.
2. Substitutes `__PROJECT_ROOT__` in `.container` files and copies all Quadlet units to `~/.config/containers/systemd/`.
3. Copies auxiliary systemd units (backup and integration timers) to `~/.config/systemd/user/`.
4. Reloads the user systemd daemon.
5. Enables all stack services so they survive reboots.
6. Starts `poi-db`, waits for MariaDB readiness, and applies all pending migrations.
7. Starts `poi-api`, `poi-web`, `poi-proxy`, and `poi-phpmyadmin`.
8. Enables and starts `poi-backup.timer` (02:15 nightly) and `poi-integration.timer` (02:45 nightly).

[Go to TOC](#table-of-contents)

## Verify Installation

```bash
./scripts/status.sh
./scripts/health.sh
```

Expected healthy endpoints:

| URL | Description |
|---|---|
| `http://localhost:9010/health` | API health probe |
| `http://localhost:9010/ready` | API readiness probe |
| `http://localhost:9010/openapi.json` | OpenAPI spec |
| `http://localhost:9010/docs` | Swagger UI |
| `http://localhost:9010/phpmyadmin/` | phpMyAdmin login |
| `http://localhost:9010/` | Web UI |

[Go to TOC](#table-of-contents)

## First Login and Smoke Test

Request an access token:

```bash
curl -X POST http://localhost:9010/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"admin","password":"<your ADMIN_PASSWORD>"}'
```

Run the full integration suite:

```bash
./scripts/test-integration.sh
```

[Go to TOC](#table-of-contents)

## phpMyAdmin Access

phpMyAdmin is available at `http://localhost:9010/phpmyadmin/`.

- Log in with the `DB_USER` and `DB_PASSWORD` values from `.runtime/poi.env`.
- phpMyAdmin starts automatically as part of the stack.
- It runs inside the poi pod and communicates with MariaDB over `127.0.0.1:3306`.

[Go to TOC](#table-of-contents)

## Optional Docs Authentication

Enable HTTP basic auth on `/docs` and `/openapi.json`:

1. Set in `.runtime/poi.env`:

```
DOCS_AUTH_ENABLED=true
DOCS_AUTH_USER=<username>
DOCS_AUTH_PASS=<password>
```

2. Restart services:

```bash
./scripts/restart.sh
```

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
