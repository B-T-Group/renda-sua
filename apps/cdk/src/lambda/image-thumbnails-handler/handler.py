"""Thin Lambda: SQS image thumbnail request → Nest internal API."""
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


def call_nest_process(source_type: str, image_id: str) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    url = f"{base}/api/internal/image-thumbnails/process"
    log_info("Calling Nest thumbnail process", url=url, source_type=source_type, image_id=image_id)
    response = requests.post(
        url,
        json={"sourceType": source_type, "imageId": image_id},
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=240,
    )
    log_info(
        "Nest thumbnail process response",
        status=response.status_code,
        image_id=image_id,
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
        source_type = body.get("sourceType")
        image_id = body.get("imageId")
        if not source_type or not image_id:
            log_error("Missing sourceType/imageId in message", body=body)
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        try:
            call_nest_process(source_type, image_id)
        except Exception as e:
            log_error("Thumbnail invoke failed", error=e, image_id=image_id)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
