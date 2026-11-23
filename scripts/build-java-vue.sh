#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
maven_command="${MAVEN_COMMAND:-mvn}"
command -v "$maven_command" >/dev/null || { printf '%s\n' '需要 Maven 3.9+，请安装 Maven 或设置 MAVEN_COMMAND。' >&2; exit 1; }
command -v npm >/dev/null || { printf '%s\n' '需要 Node.js 20.19+（建议 22 LTS）和 npm。' >&2; exit 1; }
cd "$project_root/frontend"
npm ci
npm run build
cd "$project_root/backend"
"$maven_command" -Pweb clean package "$@"
printf '%s\n' "构建完成：$project_root/backend/target/ams-1.0.0.jar"
