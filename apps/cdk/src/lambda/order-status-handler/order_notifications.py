"""Order cancellation emails via Resend."""
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from rendasua_core_packages.notification_handler.resend_client import (
    send_resend_template_email,
)
from rendasua_core_packages.secrets_manager import get_resend_api_key


def log_info(message: str, **kwargs: Any) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    print(f"[INFO] [order_notifications] {message}" + (f" | {ctx}" if ctx else ""))


def log_error(message: str, error: Exception | None = None, **kwargs: Any) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    err = f" | error={str(error)}" if error else ""
    print(
        f"[ERROR] [order_notifications] {message}"
        + (f" | {ctx}" if ctx else "")
        + err
    )


def _esc(content: Any) -> Any:
    if isinstance(content, str):
        return (
            content.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
            .replace("/", "&#x2F;")
        )
    if isinstance(content, list):
        return [_esc(item) for item in content]
    if isinstance(content, dict):
        return {k: _esc(v) for k, v in content.items()}
    return content


def _locale_for_recipient(data: Dict[str, Any], recipient_type: str) -> str:
    keys = {
        "client": "clientPreferredLanguage",
        "business": "businessPreferredLanguage",
        "agent": "agentPreferredLanguage",
    }
    raw = data.get(keys.get(recipient_type, ""))
    if not raw or not str(raw).strip():
        return "fr"
    return "fr" if str(raw).lower().startswith("fr") else "en"


def _notes_section(notes: Optional[str], locale: str) -> str:
    if not notes or not str(notes).strip():
        return ""
    label = "Raison :" if locale == "fr" else "Reason:"
    return f"<p><strong>{label}</strong> {_esc(str(notes))}</p>"


def _cancellation_template_id(recipient_type: str, locale: str) -> str:
    env_names = {
        ("client", "en"): "RESEND_CLIENT_ORDER_CANCELLED_TEMPLATE_ID",
        ("client", "fr"): "RESEND_CLIENT_ORDER_CANCELLED_TEMPLATE_ID_FR",
        ("business", "en"): "RESEND_BUSINESS_ORDER_CANCELLED_TEMPLATE_ID",
        ("business", "fr"): "RESEND_BUSINESS_ORDER_CANCELLED_TEMPLATE_ID_FR",
        ("agent", "en"): "RESEND_AGENT_ORDER_CANCELLED_TEMPLATE_ID",
        ("agent", "fr"): "RESEND_AGENT_ORDER_CANCELLED_TEMPLATE_ID_FR",
    }
    en_key = env_names[(recipient_type, "en")]
    fr_key = env_names[(recipient_type, "fr")]
    if locale == "fr":
        return (os.environ.get(fr_key) or os.environ.get(en_key) or "").strip()
    return (os.environ.get(en_key) or "").strip()


def _prepare_variables(data: Dict[str, Any], user_type: str, locale: str) -> Dict[str, Any]:
    if not data:
        raise ValueError("Notification data is undefined")
    cur = str(data.get("currency") or "USD")
    notes_html = _notes_section(data.get("notes"), locale)
    year = datetime.now().year
    base: Dict[str, Any] = {
        "orderId": _esc(str(data.get("orderId", "Unknown"))),
        "orderNumber": _esc(str(data.get("orderNumber", "Unknown"))),
        "orderStatus": _esc(str(data.get("orderStatus", "Unknown"))),
        "subtotal": data.get("subtotal", 0),
        "deliveryFee": data.get("deliveryFee", 0),
        "taxAmount": data.get("taxAmount", 0),
        "totalAmount": data.get("totalAmount", 0),
        "currency": _esc(cur),
        "deliveryAddress": _esc(str(data.get("deliveryAddress", "Unknown Address"))),
        "estimatedDeliveryTime": _esc(data.get("estimatedDeliveryTime") or ""),
        "deliveryTimeWindow": _esc(data.get("estimatedDeliveryTime") or ""),
        "specialInstructions": _esc(data.get("specialInstructions") or ""),
        "notes": _esc(data.get("notes") or ""),
        "businessVerified": "true" if data.get("businessVerified") else "false",
        "currentYear": year,
        "ORDER_ITEMS_HTML": "",
        "ESTIMATED_DELIVERY_SECTION_HTML": "",
        "SPECIAL_INSTRUCTIONS_SECTION_HTML": "",
        "NOTES_SECTION_HTML": notes_html,
        "AGENT_NAME_SECTION_HTML": "",
    }
    if user_type == "client":
        if not data.get("clientName") or not data.get("businessName"):
            raise ValueError("Client/business name required")
        base.update(
            {
                "recipientName": _esc(data.get("clientName")),
                "businessName": _esc(data.get("businessName")),
                "agentName": _esc(data.get("agentName") or "Delivery Agent"),
            }
        )
    elif user_type == "business":
        if not data.get("businessName") or not data.get("clientName"):
            raise ValueError("Business/client name required")
        base.update(
            {
                "recipientName": _esc(data.get("businessName")),
                "clientName": _esc(data.get("clientName")),
                "agentName": _esc(data.get("agentName") or "Delivery Agent"),
            }
        )
    elif user_type == "agent":
        if not data.get("agentName") or not data.get("clientName"):
            raise ValueError("Agent/client name required")
        base.update(
            {
                "recipientName": _esc(data.get("agentName")),
                "clientName": _esc(data.get("clientName")),
                "businessName": _esc(data.get("businessName")),
            }
        )
    return base


def get_recipients_for_cancellation(data: Dict[str, Any]) -> List[Dict[str, str]]:
    recipients: List[Dict[str, str]] = []
    if data.get("clientEmail"):
        recipients.append({"email": data["clientEmail"], "type": "client"})
    if data.get("businessEmail"):
        recipients.append({"email": data["businessEmail"], "type": "business"})
    if data.get("agentEmail"):
        recipients.append({"email": data["agentEmail"], "type": "agent"})
    return recipients


def send_email_resend(
    to: str,
    template_id: str,
    variables: Dict[str, Any],
    api_key: str,
    from_email: str,
) -> bool:
    if not all([to, template_id, api_key, from_email]):
        log_error("Missing email, template, key, or from address")
        return False
    ok, detail = send_resend_template_email(api_key, from_email, to, template_id, variables)
    if ok:
        log_info("Resend email sent", to=to)
        return True
    log_error("Resend send failed", error=None, detail=detail, to=to)
    return False


def send_cancellation_notifications(data: Dict[str, Any], environment: str) -> int:
    log_info(
        "Cancellation notifications",
        order_id=data.get("orderId"),
        order_number=data.get("orderNumber"),
    )
    api_key = get_resend_api_key(environment)
    if not api_key:
        log_error("Resend API key not available", environment=environment)
        return 0
    from_email = os.environ.get("RESEND_FROM_EMAIL", "Rendasua <noreply@rendasua.com>")
    recipients = get_recipients_for_cancellation(data)
    success_count = 0
    for recipient in recipients:
        rtype = recipient["type"]
        email = recipient["email"]
        loc = _locale_for_recipient(data, rtype)
        tid = _cancellation_template_id(rtype, loc)
        if not tid:
            log_error("Template id not configured", recipient_type=rtype, locale=loc)
            continue
        try:
            variables = _prepare_variables(data, rtype, loc)
            if send_email_resend(email, tid, variables, api_key, from_email):
                success_count += 1
        except Exception as exc:
            log_error(
                "Send failed",
                error=exc,
                recipient_type=rtype,
                recipient_email=email,
            )
    log_info(
        "Cancellation batch done",
        success_count=success_count,
        total=len(recipients),
    )
    return success_count
