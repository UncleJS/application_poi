[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# API Guide

## Table of Contents
- [OpenAPI Contract](#openapi-contract)
- [Local Endpoints](#local-endpoints)
- [Authentication Flow](#authentication-flow)
- [Authentication Routes](#authentication-routes)
- [POI Routes](#poi-routes)
- [Photo Routes](#photo-routes)
- [Common Request Examples](#common-request-examples)
- [Date and Time Formats](#date-and-time-formats)

## OpenAPI Contract
- OpenAPI is the source of truth.
- Spec endpoint: `/openapi.json`.
- Swagger UI endpoint: `/docs`.

[Go to TOC](#table-of-contents)

## Local Endpoints
- Base URL: `http://localhost:9010`
- Health: `GET /health`
- Ready: `GET /ready`
- Spec: `GET /openapi.json`
- Docs: `GET /docs`

[Go to TOC](#table-of-contents)

## Authentication Flow
1. Call `POST /auth/login` with admin username/password.
2. Use `accessToken` as `Authorization: Bearer <token>` for write routes.
3. Refresh with `POST /auth/refresh` before/after access expiry.
4. Keep refresh token private; do not log or commit it.

[Go to TOC](#table-of-contents)

## Authentication Routes
- `POST /auth/login`
- `POST /auth/refresh`

[Go to TOC](#table-of-contents)

## POI Routes
- `GET /api/pois` (search/filter with bbox, radius, category, text)
- `GET /api/pois/{id}`
- `POST /api/pois` (JWT required)
- `PATCH /api/pois/{id}` (JWT required)
- `DELETE /api/pois/{id}` archive only (JWT required)
- `POST /api/pois/{id}/restore` restore flow (JWT required)
- `POST /api/pois/{id}/photos` upload photo (JWT required)

[Go to TOC](#table-of-contents)

## Photo Routes
- `GET /api/photos/{id}`
- `DELETE /api/photos/{id}` archive only (JWT required)
- `POST /api/photos/{id}/restore` restore flow (JWT required)

[Go to TOC](#table-of-contents)

## Common Request Examples
Login:

```bash
curl -X POST http://localhost:9010/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"admin","password":"change_me_admin_password"}'
```

Create POI:

```bash
curl -X POST http://localhost:9010/api/pois \
  -H "content-type: application/json" \
  -H "authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"name":"POI","description":"Example","category":"general","lat":-33.9,"lng":18.4}'
```

Radius query:

```bash
curl "http://localhost:9010/api/pois?lat=-33.9&lng=18.4&radiusKm=10"
```

Upload photo:

```bash
curl -X POST http://localhost:9010/api/pois/<POI_ID>/photos \
  -H "authorization: Bearer <ACCESS_TOKEN>" \
  -F "photo=@/path/to/image.png;type=image/png"
```

[Go to TOC](#table-of-contents)

## Date and Time Formats
- Date-only input/display format: `yyyy-mm-dd`.
- Timestamp format: UTC ISO-8601 with `Z` suffix.
- Database timestamps are stored in UTC.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
