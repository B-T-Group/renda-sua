#!/usr/bin/env bash
# Writes expo.version in app.json from a semver tag (vX.Y.Z) or explicit VERSION.
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  if [[ "${GITHUB_REF:-}" == refs/tags/v* ]]; then
    VERSION="${GITHUB_REF_NAME#v}"
  elif [[ -n "${APP_VERSION_INPUT:-}" ]]; then
    VERSION="$APP_VERSION_INPUT"
  else
    echo "Keeping existing expo.version in app.json"
    exit 0
  fi
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid semver: $VERSION" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const path = 'app.json';
const version = process.argv[1];
const app = JSON.parse(fs.readFileSync(path, 'utf8'));
app.expo.version = version;
fs.writeFileSync(path, JSON.stringify(app, null, 2) + '\n');
console.log('Set expo.version to ' + version);
" "$VERSION"
