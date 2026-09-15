#!/usr/bin/env bash
# Stable Expo iOS simulator runs:
# - Node 20+ (Metro needs Array.prototype.toReversed)
# - Packager advertised as 127.0.0.1 (avoids personal-hotspot / Wi-Fi IP churn)
# - Watchman project root refreshed when available
#
# For a physical device, use: yarn ios:device
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$MAJOR" -lt 20 ]]; then
  echo "Node $(node -v) is too old for Metro. Use Node 20+ (nvm use 22)." >&2
  exit 1
fi

# Expo UrlCreator honors this over the detected LAN address (e.g. 172.20.10.x hotspot).
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-127.0.0.1}"

if command -v watchman >/dev/null 2>&1; then
  watchman watch-project "$ROOT" >/dev/null 2>&1 || true
fi

exec npx expo run:ios "$@"
