"""Thin Lambda: SQS admin broadcast → Nest internal API."""
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


def call_nest_broadcast(campaign_id: str, after_user_id: Optional[str] = None) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    url = f"{base}/api/notifications/internal/admin-broadcast"
    payload = {"campaignId": campaign_id}
    if after_user_id:
        payload["afterUserId"] = after_user_id
    log_info(
        "Calling Nest admin broadcast",
        url=url,
        campaign_id=campaign_id,
        after_user_id=after_user_id or "",
    )
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
        "Nest admin broadcast response",
        status=response.status_code,
        campaign_id=campaign_id,
        body=response.text[:500],
    )
    response.raise_for_status()
    try:
        body = response.json()
    except Exception:
        return {"success": response.ok}
    if isinstance(body, dict) and body.get("success") is False:
        raise RuntimeError(body.get("error") or "admin broadcast failed")
    return body


def handler(event, context):
    records = event.get("Records") or []
    failures = []
    for record in records:
        body = parse_body(record)
        if not body:
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        campaign_id = body.get("campaignId")
        if not campaign_id:
            log_error("Missing campaignId in message", body=body)
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        after_user_id = body.get("afterUserId") or None
        try:
            call_nest_broadcast(campaign_id, after_user_id)
        except Exception as e:
            log_error("Admin broadcast invoke failed", error=e, campaign_id=campaign_id)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
