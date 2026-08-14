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


def is_dlq_record(record: Dict[str, Any]) -> bool:
    arn = record.get("eventSourceARN") or ""
    return "ai-image-cleanup-dlq-" in arn


def nest_headers(key: str) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Rendasua-Internal-Key": key,
    }


def nest_base_and_key() -> tuple[str, str]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    return base, key


def call_nest_process(job_id: str) -> Dict[str, Any]:
    base, key = nest_base_and_key()
    url = f"{base}/api/internal/ai-image-cleanup/jobs/{job_id}/process"
    log_info("Calling Nest AI image cleanup", url=url, job_id=job_id)
    response = requests.post(url, json={}, headers=nest_headers(key), timeout=840)
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


def call_nest_fail(job_id: str, timestamp: Optional[str] = None) -> Dict[str, Any]:
    base, key = nest_base_and_key()
    url = f"{base}/api/internal/ai-image-cleanup/jobs/{job_id}/fail"
    payload = {"timestamp": timestamp} if timestamp else {}
    log_info("Calling Nest AI image cleanup fail", url=url, job_id=job_id)
    response = requests.post(
        url, json=payload, headers=nest_headers(key), timeout=60
    )
    log_info(
        "Nest AI image cleanup fail response",
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
            if is_dlq_record(record):
                call_nest_fail(job_id, body.get("timestamp"))
            else:
                call_nest_process(job_id)
        except Exception as e:
            log_error("AI image cleanup invoke failed", error=e, job_id=job_id)
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
