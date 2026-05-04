"""Call Nest API to send SMS (Orange) — used by notify-agents when email is missing."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Tuple


def send_sms_via_nest_api(to: str, message: str) -> Tuple[bool, str]:
    """
    POST /api/notifications/internal/sms with X-Rendasua-Internal-Key.

    Env:
      BACKEND_INTERNAL_API_BASE_URL — e.g. https://dev.api.rendasua.com (no trailing slash)
      NOTIFICATIONS_INTERNAL_API_KEY — must match Nest NOTIFICATIONS_INTERNAL_API_KEY
    """
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").strip().rstrip("/")
    api_key = (os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or "").strip()
    if not base or not api_key:
        return (
            False,
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY not configured",
        )
    url = f"{base}/api/notifications/internal/sms"
    payload = json.dumps({"to": to, "message": message}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": api_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if resp.status not in (200, 201):
                return False, raw or f"HTTP {resp.status}"
            data: Dict[str, Any] = {}
            if raw:
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    return False, "Invalid JSON response"
            if data.get("success") is True:
                return True, ""
            return False, str(data.get("error") or "SMS send failed")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return False, f"HTTP {e.code}: {err_body}"
    except Exception as e:
        return False, str(e)
