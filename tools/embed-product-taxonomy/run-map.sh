#!/usr/bin/env bash
# Map item_sub_categories → Google/FB product taxonomy for prod or dev.
# Usage:
#   ./run-map.sh prod [--min-similarity 0.35] [--embed-taxonomy]
#   ./run-map.sh dev  [--min-similarity 0.45]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_NAME="${1:-}"
shift || true

if [[ "$ENV_NAME" != "prod" && "$ENV_NAME" != "dev" ]]; then
  echo "Usage: $0 <prod|dev> [--min-similarity N] [--embed-taxonomy] [--verbose]" >&2
  exit 2
fi

REGION="${AWS_REGION:-ca-central-1}"
if [[ "$ENV_NAME" == "prod" ]]; then
  SECRET_ID="production-rendasua-backend-secrets"
else
  SECRET_ID="development-rendasua-backend-secrets"
fi

MIN_SIM="0.45"
EMBED_TAXONOMY=0
VERBOSE=0
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --min-similarity)
      MIN_SIM="${2:?}"
      shift 2
      ;;
    --embed-taxonomy)
      EMBED_TAXONOMY=1
      shift
      ;;
    --verbose|-v)
      VERBOSE=1
      shift
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

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

CMD=(python embed_product_taxonomy.py --map-subcategories --min-similarity "$MIN_SIM")
if [[ "$EMBED_TAXONOMY" -eq 0 ]]; then
  CMD+=(--no-embed-taxonomy)
fi
if [[ "$VERBOSE" -eq 1 ]]; then
  CMD+=(-v)
fi
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  CMD+=("${EXTRA_ARGS[@]}")
fi

echo "Running: ${CMD[*]}"
"${CMD[@]}"

"$PYTHON_BIN" - <<'PY'
import os
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT count(*) AS total,
           count(fb_product_category) AS with_fb,
           count(google_product_category) AS with_google
    FROM public.item_sub_categories
    """
)
total, with_fb, with_google = cur.fetchone()
print(f"coverage total={total} with_fb={with_fb} with_google={with_google} missing_fb={total - with_fb}")
conn.close()
PY
