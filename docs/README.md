[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Documentation Hub

## Table of Contents
- [Purpose](#purpose)
- [Document Map](#document-map)
- [Audience](#audience)
- [How to Read This Docs Set](#how-to-read-this-docs-set)
- [Change Control Notes](#change-control-notes)

## Purpose
This directory contains operational and technical documentation for the OSM POI platform running on rootless Podman with systemd user services.

[Go to TOC](#table-of-contents)

## Document Map
- `INSTALL.md` setup and first boot
- `OPERATIONS.md` service lifecycle and day-2 operations
- `SCRIPTS.md` full reference for every shell automation script
- `BACKUP_RESTORE.md` backup, restore, and safety steps
- `TROUBLESHOOTING.md` common failures and recovery actions
- `SECURITY.md` hardening and authentication controls
- `API.md` OpenAPI and endpoint contract
- `LICENSE.md` licensing and attribution details

[Go to TOC](#table-of-contents)

## Audience
- Developers building API and frontend services
- Operators maintaining local and server deployments
- Security reviewers validating auth and data handling

[Go to TOC](#table-of-contents)

## How to Read This Docs Set
- Start with `INSTALL.md` for first-time deployment.
- Use `OPERATIONS.md` as the daily runbook once the stack is up.
- Keep `SCRIPTS.md` open when working with automation commands.
- Use `BACKUP_RESTORE.md` and `TROUBLESHOOTING.md` during incidents.
- Use `API.md` and `SECURITY.md` when implementing or reviewing changes.

[Go to TOC](#table-of-contents)

## Change Control Notes
- Every operational change should be validated with `./scripts/health.sh`.
- Application behavior changes should run through `./scripts/test-integration.sh`.
- Backup and restore workflows should be periodically exercised in local test cycles.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
