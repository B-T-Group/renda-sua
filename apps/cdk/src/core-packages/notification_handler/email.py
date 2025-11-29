"""
Email notification helpers built on SendGrid.

This module is intentionally small and focused so that most of the
business logic stays within the order-status Lambda while SendGrid
integration details live in the shared core package.
"""

from typing import Any, Dict

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


def send_dynamic_template_email(
    to_email: str,
    template_id: str,
    dynamic_template_data: Dict[str, Any],
    api_key: str,
    from_email: str,
) -> bool:
    if not to_email or not template_id or not dynamic_template_data or not api_key:
        return False
    message = Mail(from_email=from_email, to_emails=to_email)
    message.template_id = template_id
    message.dynamic_template_data = dynamic_template_data
    client = SendGridAPIClient(api_key)
    response = client.send(message)
    return 200 <= response.status_code < 300


def send_cancellation_notifications(
    notifications: Dict[str, Any],
) -> int:
    """
    Thin wrapper that expects pre-computed notification payloads.

    The existing order-status Lambda remains responsible for building
    the dynamic template data; this function just loops and sends.
    """
    api_key = notifications.get("api_key")
    from_email = notifications.get("from_email")
    template_id = notifications.get("template_id")
    recipients = notifications.get("recipients", [])
    success_count = 0
    for item in recipients:
        email = item.get("email")
        data = item.get("data") or {}
        if send_dynamic_template_email(
            email,
            template_id,
            data,
            api_key,
            from_email,
        ):
            success_count += 1
    return success_count


