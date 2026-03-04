[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Installation Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Required Local Paths](#required-local-paths)
- [Configure Environment](#configure-environment)
- [Build Local Images](#build-local-images)
- [Install Services](#install-services)
- [Verify Installation](#verify-installation)
- [First Login and Smoke Test](#first-login-and-smoke-test)
- [Optional Docs Authentication](#optional-docs-authentication)

## Prerequisites
- Linux user session with `systemd --user`
- `podman` installed
- `systemctl` available
- `curl` available for health checks
- `python` available for integration scripts

[Go to TOC](#table-of-contents)

## Required Local Paths
- Runtime env file: `~/.config/poi-stack/poi.env`
- Backup output directory: `~/.config/poi-stack/backups/`
- Nightly integration logs: `~/.config/poi-stack/logs/`
- User unit install location: `~/.config/systemd/user/`
- User Quadlet location: `~/.config/containers/systemd/`

[Go to TOC](#table-of-contents)

## Configure Environment
1. Create runtime config directory:
   - `mkdir -p ~/.config/poi-stack`
2. Copy env template:
   - `cp .env.example ~/.config/poi-stack/poi.env`
3. Edit required secrets and values in `~/.config/poi-stack/poi.env`.
4. Keep `ADMIN_USER` and `ADMIN_PASSWORD` set for JWT login.
5. Set `DOCS_AUTH_ENABLED=true` to protect `/docs` and `/openapi.json` with basic auth.

[Go to TOC](#table-of-contents)

## Build Local Images
Run:

```bash
./scripts/build.sh
```

The script builds local images expected by Quadlet units:
- `localhost/poi-api:latest`
- `localhost/poi-web:latest`
- `localhost/poi-proxy:latest`

[Go to TOC](#table-of-contents)

## Install Services
Run:

```bash
./scripts/install.sh
```

This copies Quadlet files into `~/.config/containers/systemd`, reloads user systemd, and enables/starts all POI services.
It also installs and enables backup and nightly integration timers.

[Go to TOC](#table-of-contents)

## Verify Installation
Run:

```bash
./scripts/status.sh
./scripts/health.sh
```

Expected local endpoints:
- `http://localhost:9010/health`
- `http://localhost:9010/ready`
- `http://localhost:9010/openapi.json`
- `http://localhost:9010/docs`

[Go to TOC](#table-of-contents)

## First Login and Smoke Test
1. Request access token:

```bash
curl -X POST http://localhost:9010/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"admin","password":"change_me_admin_password"}'
```

2. Run full integration checks:

```bash
./scripts/test-integration.sh
```

[Go to TOC](#table-of-contents)

## Optional Docs Authentication
- Enable docs protection by setting `DOCS_AUTH_ENABLED=true` in `~/.config/poi-stack/poi.env`.
- Keep `DOCS_AUTH_USER` and `DOCS_AUTH_PASS` populated.
- Restart services after changing auth flags:

```bash
./scripts/restart.sh
```

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
