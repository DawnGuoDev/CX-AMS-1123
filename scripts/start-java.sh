#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$project_root/.env.local" ]]; then
  set -a
  source "$project_root/.env.local"
  set +a
fi
export PORT="${PORT:-8180}"
java_command="${JAVA_HOME:+$JAVA_HOME/bin/}java"
if [[ ! -f "$project_root/backend/target/ams-1.0.0.jar" ]]; then
  printf '%s\n' '请先执行 bash scripts/build-java-vue.sh。' >&2
  exit 1
fi
cd "$project_root/backend"
exec "$java_command" -jar target/ams-1.0.0.jar "$@"
