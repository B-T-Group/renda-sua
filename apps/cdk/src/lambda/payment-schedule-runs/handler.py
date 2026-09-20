"""Daily EventBridge cron → Nest payment-schedule runner."""
import os
from typing import Any, Dict

import requests


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        return {"success": False, "error": "missing internal api config"}
    url = f"{base}/api/internal/payment-schedule-runs/run"
    response = requests.post(
        url,
        json={},
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        timeout=840,
    )
    response.raise_for_status()
    try:
        body = response.json()
    except Exception:
        body = {"success": response.ok}
    return {"success": True, **body}
