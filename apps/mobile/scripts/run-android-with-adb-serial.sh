#!/usr/bin/env bash
# Expo can cache a short wireless ADB id that no longer matches `adb devices`.
# Export ANDROID_SERIAL from the first row in "device" state (tab-separated).
set -euo pipefail
line="$(adb devices | awk -F'\t' '$2=="device" { print $1; exit }')"
if [[ -z "${line}" ]]; then
  echo "No device in 'device' state. Plug in USB or fix wireless debugging, then: adb devices" >&2
  exit 1
fi
export ANDROID_SERIAL="${line}"
echo "Using ANDROID_SERIAL=${ANDROID_SERIAL}"
exec npx expo run:android "$@"
