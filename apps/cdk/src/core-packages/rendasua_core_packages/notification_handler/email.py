"""
Email notification helpers using Resend transactional templates.
"""

from __future__ import annotations

from typing import Any, Dict

from .resend_client import send_resend_template_email


def send_cancellation_notifications(notifications: Dict[str, Any]) -> int:
    """
    Send emails using pre-built payloads.

    Expected keys: api_key, from_email, recipients (list of
    { email, template_id, data }).
    """
    api_key = notifications.get("api_key")
    from_email = notifications.get("from_email")
    if not api_key or not from_email:
        return 0
    recipients = notifications.get("recipients", [])
    success_count = 0
    for item in recipients:
        email = item.get("email")
        template_id = item.get("template_id")
        data = item.get("data") or {}
        ok, _ = send_resend_template_email(
            api_key or "",
            from_email or "",
            email or "",
            template_id or "",
            data,
        )
        if ok:
            success_count += 1
    return success_count
