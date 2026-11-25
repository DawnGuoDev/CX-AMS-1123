#!/usr/bin/env bash
# Requires bash (uses `set -o pipefail`); it must be run as `bash scripts/run-frontend-e2e.sh`
# or `./scripts/run-frontend-e2e.sh`, not with `sh`.
# Frontend E2E: build the UI, start a throw-away backend, then run Playwright against the
# same-origin test server (static build + /api proxy). Nothing is written into ./data.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
java_bin="${JAVA_HOME:+$JAVA_HOME/bin/}java"
maven_command="${MAVEN_COMMAND:-mvn}"
api_port="${AMS_E2E_API_PORT:-18180}"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ams-fe-e2e.XXXXXX")"
backend_pid=""
serve_pid=""
cleanup() {
  for pid in "$serve_pid" "$backend_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -rf "$work_dir"
}
trap cleanup EXIT

if [[ ! -f "$project_root/backend/target/ams-1.0.0.jar" || -n "${AMS_E2E_REBUILD:-}" ]]; then
  (cd "$project_root/backend" && "$maven_command" -B -DskipTests package)
fi
if [[ ! -d "$project_root/frontend/dist" || -n "${AMS_E2E_REBUILD:-}" ]]; then
  (cd "$project_root/frontend" && npm ci && npm run build)
fi
if [[ ! -d "$project_root/e2e/node_modules" ]]; then
  (cd "$project_root/e2e" && npm ci)
fi

(cd "$project_root/backend" && exec "$java_bin" -jar target/ams-1.0.0.jar \
  --server.port="$api_port" --server.address=127.0.0.1 \
  --spring.datasource.url="jdbc:h2:file:$work_dir/ams-db;DB_CLOSE_ON_EXIT=FALSE" \
  --ams.scheduling=false --ams.public-url="http://127.0.0.1:4173") \
  >"$work_dir/backend.log" 2>&1 &
backend_pid=$!

healthy=""
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$api_port/health" >/dev/null 2>&1; then healthy=1; break; fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    tail -n 60 "$work_dir/backend.log" >&2
    exit 1
  fi
  sleep 0.5
done
if [[ -z "$healthy" ]]; then
  tail -n 60 "$work_dir/backend.log" >&2
  exit 1
fi

# Serve the built UI and proxy /api + /health to the throw-away backend.
(cd "$project_root/e2e" && exec env AMS_API_TARGET="http://127.0.0.1:$api_port" node serve.mjs) \
  >"$work_dir/serve.log" 2>&1 &
serve_pid=$!
served=""
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:4173/health" >/dev/null 2>&1; then served=1; break; fi
  sleep 0.5
done
if [[ -z "$served" ]]; then
  cat "$work_dir/serve.log" >&2
  exit 1
fi

cd "$project_root/e2e"
npx playwright test --reporter=list "$@" || {
  status=$?
  printf '\n测试失败，后端日志最后 40 行（%s）：\n' "$work_dir/backend.log" >&2
  tail -n 40 "$work_dir/backend.log" >&2 || true
  exit "$status"
}
