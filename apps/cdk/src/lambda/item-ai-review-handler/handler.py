"""Thin Lambda: SQS sale item AI review → Nest internal API."""
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


def call_nest_ai_review(item_id: str, review_version: Optional[int]) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError("BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing")
    url = f"{base}/api/internal/items/{item_id}/ai-review"
    payload: Dict[str, Any] = {}
    if review_version is not None:
        payload["reviewVersion"] = review_version
    log_info("Calling Nest AI review", url=url, item_id=item_id)
    # Align with Lambda timeout (15m): chat review + up to 2 image cleanups.
    response = requests.post(
        url,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=840,
    )
    log_info(
        "Nest AI review response",
        status=response.status_code,
        item_id=item_id,
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
        item_id = body.get("itemId")
        if not item_id:
            log_error("Missing itemId in message", body=body)
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        try:
            call_nest_ai_review(item_id, body.get("reviewVersion"))
        except Exception as e:
            log_error("AI review invoke failed", error=e, item_id=item_id)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
