#!/bin/bash
set -euo pipefail

BRIDGE_URL="${CAMPUS_URL:-http://127.0.0.1:3100}"
DESKTOP_APP="${WOLLY_DESKTOP_APP:?WOLLY_DESKTOP_APP is required}"

for _ in {1..20}; do
    curl --fail --silent --show-error "$BRIDGE_URL/api/pet/mode" >/dev/null && break
    sleep 1
done

exec "$DESKTOP_APP"
