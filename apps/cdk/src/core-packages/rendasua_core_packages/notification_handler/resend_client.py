"""Resend REST API helper for transactional template emails."""

from __future__ import annotations

import json
from typing import Any, Dict

import requests

RESEND_EMAILS_URL = "https://api.resend.com/emails"


def _serialize_variables(variables: Dict[str, Any]) -> Dict[str, str]:
    """Resend validates template variables against dashboard types; use strings for all."""
    out: Dict[str, str] = {}
    for key, val in variables.items():
        if val is None:
            out[key] = ""
        else:
            out[key] = str(val)
    return out


def send_resend_template_email(
    api_key: str,
    from_email: str,
    to_email: str,
    template_id: str,
    variables: Dict[str, Any],
) -> tuple[bool, str]:
    if not (api_key and from_email and to_email and template_id):
        return False, "missing required fields"
    payload = {
        "from": from_email,
        "to": [to_email],
        "template": {
            "id": template_id,
            "variables": _serialize_variables(variables),
        },
    }
    try:
        response = requests.post(
            RESEND_EMAILS_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps(payload),
            timeout=30,
        )
    except requests.RequestException as exc:
        return False, str(exc)
    if 200 <= response.status_code < 300:
        return True, ""
    body = response.text[:500] if response.text else ""
    return False, f"status={response.status_code} body={body}"
