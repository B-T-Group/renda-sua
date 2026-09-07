#!/usr/bin/env bash
# Promote main to prod: checkout prod, merge main, push, return to main.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash before running." >&2
  exit 1
fi

original_branch="$(git rev-parse --abbrev-ref HEAD)"

on_error() {
  echo "merge-main-into-prod failed." >&2
  git checkout "${original_branch}" 2>/dev/null || true
  exit 1
}
trap on_error ERR

echo "→ checkout prod"
git checkout prod

echo "→ merge main into prod"
git merge main --no-edit

echo "→ push prod to origin"
git push origin prod

echo "→ checkout main"
git checkout main

trap - ERR
echo "Done. prod is updated on origin; you are on main."
