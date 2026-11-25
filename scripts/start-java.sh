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
# Boot loads classes and static assets lazily. Maven must never overwrite the
# archive of a live process, so launch an immutable, content-addressed copy.
if command -v sha256sum >/dev/null 2>&1; then
  artifact_hash="$(sha256sum target/ams-1.0.0.jar | cut -d ' ' -f 1)"
else
  artifact_hash="$(shasum -a 256 target/ams-1.0.0.jar | cut -d ' ' -f 1)"
fi
mkdir -p .runtime
runtime_jar=".runtime/ams-${artifact_hash}.jar"
if [[ ! -f "$runtime_jar" ]]; then
  staging_jar="$(mktemp .runtime/staging.XXXXXX)"
  cp target/ams-1.0.0.jar "$staging_jar"
  mv "$staging_jar" "$runtime_jar"
fi
exec "$java_command" -jar "$runtime_jar" "$@"
