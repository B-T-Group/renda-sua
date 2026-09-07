#!/bin/bash
set -e

# Find the git repository root
REPO_ROOT=$(git rev-parse --show-toplevel)

if [ -z "$REPO_ROOT" ]; then
  echo "Error: Not in a git repository"
  exit 1
fi

echo "Found repository root: $REPO_ROOT"
cd "$REPO_ROOT"

echo "Checking out prod branch..."
git checkout prod

echo "Merging main into prod..."
git merge main

echo "Pushing prod to origin..."
git push origin prod

echo "Checking out main branch..."
git checkout main

echo "✅ Successfully merged main into prod and pushed changes"
