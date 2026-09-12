#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
ENV_NAME="${1:?env required: prod|dev}"
MODE="${2:?mode required: dry-run|apply}"
python3 -m pip install -q psycopg2-binary >/dev/null
exec python3 consolidate_export_catalog.py "$ENV_NAME" "$MODE"
