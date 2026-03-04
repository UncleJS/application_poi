[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Installation Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Configure Environment](#configure-environment)
- [Build Local Images](#build-local-images)
- [Install Services](#install-services)
- [Verify Installation](#verify-installation)

## Prerequisites
- Linux user session with `systemd --user`
- `podman` installed
- `systemctl` available
- `curl` available for health checks

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

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
