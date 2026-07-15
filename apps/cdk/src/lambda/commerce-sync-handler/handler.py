"""Thin Lambda: SQS commerce sync messages → Nest internal API."""
import json
import os
from typing import Any, Dict, Optional

import requests


def log_info(message: str, **kwargs):
    context = " ".join(f"{k}={v}" for k, v in kwargs.items())
    print(f"[INFO] {message}" + (f" | {context}" if context else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    context = " ".join(f"{k}={v}" for k, v in kwargs.items())
    err = f" | error={error}" if error else ""
    print(f"[ERROR] {message}" + (f" | {context}" if context else "") + err)


def parse_body(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(record.get("body", "{}"))
    except Exception as e:
        log_error("Failed to parse SQS body", error=e)
        return None


def call_nest_process(payload: Dict[str, Any]) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    url = f"{base}/api/commerce-integrations/internal/process"
    log_info("Calling Nest commerce sync", url=url, type=payload.get("type"))
    response = requests.post(
        url,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=120,
    )
    log_info(
        "Nest commerce sync response",
        status=response.status_code,
        body=response.text[:500],
    )
    response.raise_for_status()
    try:
        return response.json()
    except Exception:
        return {"success": response.ok}


def handler(event, context):
    records = event.get("Records") or []
    failures = []
    for record in records:
        body = parse_body(record)
        if not body:
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        try:
            call_nest_process(body)
        except Exception as e:
            log_error("Commerce sync invoke failed", error=e, body=body)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
