#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_PORT="${PORT:-3100}"
NPM_COMMAND="${WOLLY_NPM:-npm}"

cd "$PROJECT_ROOT"
export PORT="$WEB_PORT"
exec "$NPM_COMMAND" run dev
