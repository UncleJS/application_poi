#!/usr/bin/env bash
# test-integration.sh — End-to-end API integration test against the live stack.
#
# Why it exists:
#   Unit tests cannot catch routing, auth, or database wiring problems that only
#   manifest when the full stack is running together.  This script exercises the
#   critical user journeys — login → token refresh → POI CRUD → photo upload →
#   archive/restore → radius query — so regressions are caught before they reach
#   production.  All test data is created and archived within the test run; no
#   cleanup is needed.
#
# Usage: ./scripts/test-integration.sh
#   Requires the full stack to be running.
#   Set BASE_URL to test against a non-default host/port.
#   Also called automatically on a nightly schedule by test-nightly.sh.
set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
load_env_file

BASE_URL="${BASE_URL:-http://localhost:9010}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change_me_admin_password}"

if [[ "${ADMIN_PASSWORD}" == "change_me_admin_password" ]]; then
  echo "[FAIL] ADMIN_PASSWORD is still set to insecure default placeholder"
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

json_get() {
  local file="$1"
  local key="$2"
  python -c "import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],''))" "$file" "$key"
}

echo "[TEST] health endpoints"
./scripts/health.sh

echo "[TEST] login"
curl -sS -X POST "${BASE_URL}/auth/login" \
  -H "content-type: application/json" \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASSWORD}\"}" > "${tmp_dir}/login.json"

ACCESS_TOKEN="$(json_get "${tmp_dir}/login.json" accessToken)"
REFRESH_TOKEN="$(json_get "${tmp_dir}/login.json" refreshToken)"
[[ -n "${ACCESS_TOKEN}" && -n "${REFRESH_TOKEN}" ]] || { echo "[FAIL] missing tokens"; exit 1; }

echo "[TEST] refresh token"
curl -sS -X POST "${BASE_URL}/auth/refresh" \
  -H "content-type: application/json" \
  -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}" > "${tmp_dir}/refresh.json"

NEW_ACCESS="$(json_get "${tmp_dir}/refresh.json" accessToken)"
[[ -n "${NEW_ACCESS}" ]] || { echo "[FAIL] refresh failed"; exit 1; }

echo "[TEST] create poi"
curl -sS -X POST "${BASE_URL}/api/pois" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${NEW_ACCESS}" \
  -d '{"name":"Integration POI","description":"Created by test","category":"qa","lat":-33.9249,"lng":18.4241}' > "${tmp_dir}/poi_create.json"

POI_ID="$(json_get "${tmp_dir}/poi_create.json" id)"
[[ -n "${POI_ID}" ]] || { echo "[FAIL] poi creation failed"; exit 1; }

echo "[TEST] list poi search"
curl -sS "${BASE_URL}/api/pois?q=Integration%20POI" > "${tmp_dir}/pois_search.json"
python -c "import json,sys;d=json.load(open(sys.argv[1]));assert any(x.get('id')==sys.argv[2] for x in d)" "${tmp_dir}/pois_search.json" "${POI_ID}"

echo "[TEST] upload photo"
python -c "import base64,pathlib;pathlib.Path('${tmp_dir}/dot.png').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5KdrsAAAAASUVORK5CYII='))"
curl -sS -X POST "${BASE_URL}/api/pois/${POI_ID}/photos" \
  -H "authorization: Bearer ${NEW_ACCESS}" \
  -F "photo=@${tmp_dir}/dot.png;type=image/png" > "${tmp_dir}/photo_create.json"

PHOTO_ID="$(json_get "${tmp_dir}/photo_create.json" id)"
[[ -n "${PHOTO_ID}" ]] || { echo "[FAIL] photo upload failed"; exit 1; }

echo "[TEST] archive and restore photo"
curl -sS -X DELETE "${BASE_URL}/api/photos/${PHOTO_ID}" -H "authorization: Bearer ${NEW_ACCESS}" > "${tmp_dir}/photo_archive.json"
curl -sS -X POST "${BASE_URL}/api/photos/${PHOTO_ID}/restore" -H "authorization: Bearer ${NEW_ACCESS}" > "${tmp_dir}/photo_restore.json"

echo "[TEST] archive and restore poi"
curl -sS -X DELETE "${BASE_URL}/api/pois/${POI_ID}" -H "authorization: Bearer ${NEW_ACCESS}" > "${tmp_dir}/poi_archive.json"
curl -sS -X POST "${BASE_URL}/api/pois/${POI_ID}/restore" -H "authorization: Bearer ${NEW_ACCESS}" > "${tmp_dir}/poi_restore.json"

echo "[TEST] radius query"
curl -sS "${BASE_URL}/api/pois?lat=-33.9249&lng=18.4241&radiusKm=5" > "${tmp_dir}/radius.json"
python -c "import json,sys;d=json.load(open(sys.argv[1]));assert isinstance(d,list) and len(d)>=1" "${tmp_dir}/radius.json"

echo "[PASS] integration tests completed"
