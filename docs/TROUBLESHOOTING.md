[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Troubleshooting

## Table of Contents
- [Services Not Starting](#services-not-starting)
- [Port 9010 Unreachable](#port-9010-unreachable)
- [Database Connection Errors](#database-connection-errors)
- [Image Build Fails](#image-build-fails)
- [Health Checks Failing](#health-checks-failing)

## Services Not Starting
Run:

```bash
./scripts/status.sh
journalctl --user -u poi-api.service -n 100 --no-pager
```

Verify Quadlet files exist in `~/.config/containers/systemd/` and run `systemctl --user daemon-reload`.

[Go to TOC](#table-of-contents)

## Port 9010 Unreachable
- Confirm proxy is active: `systemctl --user is-active poi-proxy.service`.
- Check host port conflict: `podman ps --format "{{.Names}} {{.Ports}}"`.
- Ensure `poi-proxy.container` includes `PublishPort=127.0.0.1:9010:9010`.

[Go to TOC](#table-of-contents)

## Database Connection Errors
- Confirm DB service state and logs.
- Validate credentials in `~/.config/poi-stack/poi.env`.
- Run `./scripts/env-check.sh` and fix any missing keys.

[Go to TOC](#table-of-contents)

## Image Build Fails
- Ensure required source and `Containerfile` paths exist.
- Re-run `./scripts/build.sh` to see specific missing path warnings.
- Use `podman build` manually for deeper diagnostics.

[Go to TOC](#table-of-contents)

## Health Checks Failing
- Run `./scripts/health.sh`.
- Check API and proxy logs for upstream routing failures.
- Validate that API serves `/health`, `/ready`, `/openapi.json`, and `/docs`.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
