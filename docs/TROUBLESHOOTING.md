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
- [502 Bad Gateway from Caddy](#502-bad-gateway-from-caddy)
- [Database Connection Errors](#database-connection-errors)
- [phpMyAdmin Login Fails](#phpmyadmin-login-fails)
- [Image Build Fails](#image-build-fails)
- [Health Checks Failing](#health-checks-failing)
- [Integration Tests Failing](#integration-tests-failing)
- [Timer Jobs Not Running](#timer-jobs-not-running)

## Services Not Starting

Check the service state and recent journal entries:

```bash
./scripts/status.sh
journalctl --user -u poi-api.service -n 100 --no-pager
```

Common causes:
- **Unit files not installed** — run `./scripts/install.sh` or verify files exist in `~/.config/containers/systemd/`.
- **`__PROJECT_ROOT__` not substituted** — unit files must be processed by `install.sh`; copying them manually will leave the placeholder unresolved.
- **Daemon not reloaded** — run `systemctl --user daemon-reload` after any unit file change.
- **Image missing** — run `./scripts/build.sh` to build locally-tagged images.

[Go to TOC](#table-of-contents)

## Port 9010 Unreachable

- Confirm the pod and proxy are active:

```bash
systemctl --user is-active poi-proxy.service
podman ps --filter name=poi-proxy
```

- Check for port conflicts on the host:

```bash
ss -tlnp | grep 9010
```

- Verify the pod unit publishes the port (must appear in `~/.config/containers/systemd/poi.pod`):

```
PublishPort=127.0.0.1:9010:9010
```

- Individual `.container` files must **not** have `PublishPort=`; the pod owns it.

[Go to TOC](#table-of-contents)

## 502 Bad Gateway from Caddy

A 502 means Caddy can reach the proxy but cannot connect to an upstream service
inside the pod.

**Understand the pod networking model first:**
All containers in the `poi` pod share one network namespace.  They talk to each
other over `127.0.0.1` plus the target port — not via DNS container names.  The
Caddyfile must use `127.0.0.1:<port>` for every upstream.

Check the Caddyfile upstreams:

```
reverse_proxy @api 127.0.0.1:3001      # API
reverse_proxy 127.0.0.1:80             # phpMyAdmin (under handle /phpmyadmin*)
reverse_proxy 127.0.0.1:3000           # Next.js web
```

If DNS names like `poi-api:3001` appear in the Caddyfile, they will fail inside
a pod — rebuild the proxy image after correcting them:

```bash
./scripts/rebuild.sh
```

**Next.js binding issue:**
Next.js standalone mode reads the `HOSTNAME` environment variable to determine
its bind address.  Podman injects `HOSTNAME=<container-name>` which causes
Next.js to bind to the container's hostname IP rather than `0.0.0.0`, making
it unreachable from Caddy on `127.0.0.1:3000`.

The `containers/web/Containerfile` CMD works around this:

```
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 bun server.js"]
```

If the web service was rebuilt without this fix, verify:

```bash
podman exec poi-web netstat -tlnp | grep 3000
# must show  0.0.0.0:3000  not  <IP>:3000
```

**General 502 diagnosis:**

```bash
# check Caddy error log
./scripts/logs.sh proxy

# test connectivity from inside the proxy container
podman exec poi-proxy wget -q -O /dev/null http://127.0.0.1:3000/
podman exec poi-proxy wget -q -O /dev/null http://127.0.0.1:3001/health
```

[Go to TOC](#table-of-contents)

## Database Connection Errors

- Confirm DB service is active and accepting connections:

```bash
systemctl --user is-active poi-db.service
./scripts/logs.sh db
```

- Run the DB-readiness probe manually:

```bash
source scripts/common.sh && wait_for_db 30
```

- Validate credentials and `DB_HOST`:

```bash
./scripts/env-check.sh
```

`DB_HOST` must be `127.0.0.1` (pod loopback), not a DNS name like `poi-db`.

[Go to TOC](#table-of-contents)

## phpMyAdmin Login Fails

- Confirm the service is running: `systemctl --user is-active poi-phpmyadmin.service`.
- Use the MariaDB user credentials (`MARIADB_USER` / `MARIADB_PASSWORD` from `.runtime/poi.env`), not the root password.
- The Caddyfile must use `handle /phpmyadmin*` (not `handle_path`) and proxy to `127.0.0.1:80`.
- `X-Frame-Options` must be cleared in the phpMyAdmin `handle` block or the login page will be blocked.
- A patched `containers/phpmyadmin/Header.php` is volume-mounted to fix a PHP bug in phpMyAdmin 5.2.3 where `rootPath` returns `true` instead of the path string, breaking cookie path and login.  Ensure the volume mount is present in the container unit.

[Go to TOC](#table-of-contents)

## Image Build Fails

- Verify all required source paths exist before building.
- Re-run `./scripts/build.sh` to see which Containerfile is missing.
- Use `podman build` directly for verbose output:

```bash
podman build -t localhost/poi-api:latest \
  -f containers/api/Containerfile .
```

[Go to TOC](#table-of-contents)

## Health Checks Failing

```bash
./scripts/health.sh
```

- If `/health` fails: check `poi-api` and `poi-proxy` logs.
- If `/docs` returns 401 unexpectedly: verify `DOCS_AUTH_ENABLED` in `.runtime/poi.env`.
- If all endpoints fail: check if `poi-proxy` is running and port 9010 is published.

[Go to TOC](#table-of-contents)

## Integration Tests Failing

```bash
./scripts/test-integration.sh
```

- Confirm admin credentials in `.runtime/poi.env` match the test expectations (`ADMIN_USER` / `ADMIN_PASSWORD`).
- The test will refuse to run if `ADMIN_PASSWORD` is still the placeholder `change_me_admin_password`.
- After schema changes, run `./scripts/migrate.sh` and retest.
- Inspect the latest nightly log for context on recurring failures:

```bash
cat .runtime/logs/integration_latest.log
```

[Go to TOC](#table-of-contents)

## Timer Jobs Not Running

Check timer states:

```bash
systemctl --user status poi-backup.timer
systemctl --user status poi-integration.timer
systemctl --user list-timers | grep poi-
```

Manually trigger a job to confirm it executes correctly:

```bash
systemctl --user start poi-backup.service
systemctl --user start poi-integration.service
```

If timers are missing after a reinstall, re-run `./scripts/install.sh` — it
copies timer files to `~/.config/systemd/user/` and enables them.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
