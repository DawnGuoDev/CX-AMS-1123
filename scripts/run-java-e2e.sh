#!/usr/bin/env bash
# Requires bash; run with `bash scripts/run-java-e2e.sh`.
# Backend HTTP E2E: package the jar, then run TC-API-E2E-* against a real process on a random port.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
maven_command="${MAVEN_COMMAND:-mvn}"
cd "$project_root/backend"
"$maven_command" -B -DskipTests package
"$maven_command" -B -Dams.e2e.enabled=true -Dtest='com.changxin.ams.e2e.*E2ETest' test "$@"
