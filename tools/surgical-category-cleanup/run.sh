#!/usr/bin/env bash
# Surgical category cleanup wrapper for prod or dev.
# Usage:
#   ./run.sh prod inventory
#   ./run.sh dev plan
#   ./run.sh prod apply --dry-run
#   ./run.sh prod normalize --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_NAME="${1:-}"
shift || {
  echo "Usage: $0 <prod|dev> <command> [args...]" >&2
  exit 2
}

if [[ "$ENV_NAME" != "prod" && "$ENV_NAME" != "dev" ]]; then
  echo "Usage: $0 <prod|dev> <command> [args...]" >&2
  exit 2
fi

REGION="${AWS_REGION:-ca-central-1}"
if [[ "$ENV_NAME" == "prod" ]]; then
  SECRET_ID="production-rendasua-backend-secrets"
else
  SECRET_ID="development-rendasua-backend-secrets"
fi

PYTHON_BIN=""
for candidate in python3.11 python3.12 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    ver="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    major="${ver%%.*}"
    minor="${ver#*.}"
    if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 10 ]]; }; then
      PYTHON_BIN="$candidate"
      break
    fi
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "Need Python 3.10+ (python3.11 recommended)." >&2
  exit 1
fi

cd "$ROOT"
if [[ ! -d .venv ]]; then
  echo "Creating venv with $PYTHON_BIN..."
  "$PYTHON_BIN" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

echo "Fetching DATABASE_URL from Secrets Manager ($SECRET_ID)..."
export DATABASE_URL
DATABASE_URL="$(
  aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --query SecretString \
    --output text \
  | "$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_URL"])'
)"

HOST="$(
  "$PYTHON_BIN" -c 'import os; from urllib.parse import urlparse; print(urlparse(os.environ["DATABASE_URL"]).hostname or "")'
)"
echo "Connected target host: $HOST (env=$ENV_NAME)"

echo "Running: python category_cleanup.py $*"
python category_cleanup.py "$@"
