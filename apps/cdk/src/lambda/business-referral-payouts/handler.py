"""Thin Lambda: EventBridge Saturday cron → Nest internal business-referral-payouts endpoint."""
import os
from typing import Any, Dict

import requests


def log_info(message: str, **kwargs):
    context = " ".join(f"{k}={v}" for k, v in kwargs.items())
    print(f"[INFO] {message}" + (f" | {context}" if context else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    context = " ".join(f"{k}={v}" for k, v in kwargs.items())
    err = f" | error={error}" if error else ""
    print(f"[ERROR] {message}" + (f" | {context}" if context else "") + err)


def call_nest_payouts() -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError("BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing")
    url = f"{base}/api/internal/business-referral-payouts/run"
    log_info("Calling business-referral-payouts endpoint", url=url)
    response = requests.post(
        url,
        json={},
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=840,  # 14 min — Lambda timeout is 15 min
    )
    log_info(
        "Nest response",
        status=response.status_code,
        body=response.text[:500],
    )
    response.raise_for_status()
    try:
        return response.json()
    except Exception:
        return {"success": response.ok}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda entry point — invoked by EventBridge on Saturdays."""
    log_info(
        "Business-referral-payouts Lambda invoked",
        request_id=getattr(context, "aws_request_id", "unknown"),
        function_name=getattr(context, "function_name", "unknown"),
    )
    try:
        result = call_nest_payouts()
        log_info(
            "Payout run complete",
            processed=result.get("processed", 0),
            credited=result.get("credited", 0),
            skipped=result.get("skipped", 0),
            failures=result.get("failures", 0),
            skipped_reason=result.get("skippedReason", ""),
        )
        return {"success": True, **result}
    except Exception as e:
        log_error("Business-referral-payouts Lambda failed", error=e)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
