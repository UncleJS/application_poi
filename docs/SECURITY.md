[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Security Guide

## Table of Contents
- [Authentication Model](#authentication-model)
- [Authorization Boundaries](#authorization-boundaries)
- [Input Validation](#input-validation)
- [Secrets Handling](#secrets-handling)
- [Data Lifecycle](#data-lifecycle)

## Authentication Model
- JWT-based authentication for write operations.
- Access + refresh token pair is issued via `/auth/login` and rotated with `/auth/refresh`.
- Public read endpoints for map and POI discovery.
- Token issuer and audience controlled by env config.

[Go to TOC](#table-of-contents)

## Authorization Boundaries
- Write operations require authenticated user role.
- Photo upload and archive actions require JWT.
- Docs endpoints (`/docs`, `/openapi.json`) support optional basic auth via `DOCS_AUTH_ENABLED`.

[Go to TOC](#table-of-contents)

## Input Validation
- Enforce file size limit: `UPLOAD_MAX_BYTES=20971520`.
- Enforce per-POI photo limit: `PHOTO_MAX_PER_POI=10`.
- Allowlist image MIME types at API layer.
- Validate coordinate ranges and category constraints.

[Go to TOC](#table-of-contents)

## Secrets Handling
- Store env values in `~/.config/poi-stack/poi.env`.
- Do not commit secrets to source control.
- Rotate JWT and DB secrets periodically.

[Go to TOC](#table-of-contents)

## Data Lifecycle
- API delete operations are archive-only via `archived_at` fields.
- No hard-delete behavior in normal application routes.
- Restore workflows use SQL backups for operational recovery.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
