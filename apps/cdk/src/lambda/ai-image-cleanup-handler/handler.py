"""Thin Lambda: SQS AI image cleanup → Nest internal API."""
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


def call_nest_process(job_id: str) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    url = f"{base}/api/internal/ai-image-cleanup/jobs/{job_id}/process"
    log_info("Calling Nest AI image cleanup", url=url, job_id=job_id)
    response = requests.post(
        url,
        json={},
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=840,
    )
    log_info(
        "Nest AI image cleanup response",
        status=response.status_code,
        job_id=job_id,
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
        job_id = body.get("jobId")
        if not job_id:
            log_error("Missing jobId in message", body=body)
            failures.append({"itemIdentifier": record.get("messageId")})
            continue
        try:
            call_nest_process(job_id)
        except Exception as e:
            log_error("AI image cleanup invoke failed", error=e, job_id=job_id)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
