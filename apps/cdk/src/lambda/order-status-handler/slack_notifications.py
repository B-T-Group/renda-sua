"""Slack webhook alerts for order.created and order.completed (async Lambda)."""
from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

import requests

_MAX_RETRIES = 4
_BASE_SLEEP_SEC = 0.5
_TIMEOUT_SEC = 10


def _slack_log_info(msg: str, **kwargs: Any) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    print(f"[INFO] [slack_notifications] {msg}" + (f" | {ctx}" if ctx else ""))


def _slack_log_error(msg: str, error: Exception | None = None, **kwargs: Any) -> None:
    ctx = " ".join(f"{k}={v}" for k, v in kwargs.items())
    err = f" | error={str(error)}" if error else ""
    print(
        f"[ERROR] [slack_notifications] {msg}"
        + (f" | {ctx}" if ctx else "")
        + err
    )


def _escape_mrkdwn(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fmt_money(amount: float, currency: str) -> str:
    return f"{amount:g} {_escape_mrkdwn(currency)}"


def _build_items_preview(order_items: List[Dict[str, Any]], limit: int = 5) -> str:
    lines: List[str] = []
    for it in order_items[:limit]:
        name = _escape_mrkdwn(str(it.get("name", "")))
        qty = it.get("quantity", 0)
        lines.append(f"• {name} x{qty}")
    if len(order_items) > limit:
        lines.append(f"_…and {len(order_items) - limit} more_")
    return "\n".join(lines) if lines else "_No items_"


def _slack_success(status_code: int, body: str) -> bool:
    if status_code != 200:
        return False
    stripped = (body or "").strip()
    return stripped in ("", "ok")


def _should_retry_status(status_code: int) -> bool:
    return status_code >= 500 or status_code == 429


def _post_once(url: str, payload: Dict[str, Any]) -> tuple[int, str]:
    resp = requests.post(
        url,
        data=json.dumps(payload),
        headers={"Content-Type": "application/json; charset=utf-8"},
        timeout=_TIMEOUT_SEC,
    )
    return resp.status_code, resp.text or ""


def _sleep_before_retry(attempt: int) -> None:
    time.sleep(_BASE_SLEEP_SEC * (2**attempt))


def _title_block(event_kind: str) -> Dict[str, Any]:
    title = (
        "*🛒 New Order Received!*"
        if event_kind == "order.created"
        else "*✅ Order Completed!*"
    )
    return {"type": "section", "text": {"type": "mrkdwn", "text": title}}


def _customer_order_fields(data: Dict[str, Any], cur: str) -> Dict[str, Any]:
    client_raw = str(data.get("clientName") or "").strip() or "Unknown"
    client = _escape_mrkdwn(client_raw)
    order_no = _escape_mrkdwn(str(data.get("orderNumber") or ""))
    status = _escape_mrkdwn(str(data.get("orderStatus") or ""))
    total = _fmt_money(float(data.get("totalAmount", 0)), cur)
    return {
        "type": "section",
        "fields": [
            {"type": "mrkdwn", "text": f"*Customer:*\n{client}"},
            {"type": "mrkdwn", "text": f"*Order:*\n`{order_no}`"},
            {"type": "mrkdwn", "text": f"*Status:*\n{status}"},
            {"type": "mrkdwn", "text": f"*Total:*\n{total}"},
        ],
    }


def _business_address_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    biz = _escape_mrkdwn(str(data.get("businessName") or ""))
    loc = _escape_mrkdwn(str(data.get("businessLocationName") or ""))
    addr = _escape_mrkdwn(str(data.get("deliveryAddress") or "—"))
    business_line = f"{biz} — {loc}" if loc else biz
    return {
        "type": "section",
        "fields": [
            {"type": "mrkdwn", "text": f"*Business / location:*\n{business_line}"},
            {"type": "mrkdwn", "text": f"*Delivery address:*\n{addr}"},
        ],
    }


def _delivery_fee_fields(data: Dict[str, Any], cur: str) -> Dict[str, Any]:
    base_fee = float(data.get("deliveryFee", 0))
    km_fee = float(data.get("fastDeliveryFee", 0))
    delivery_txt = _fmt_money(base_fee + km_fee, cur)
    base_txt = _fmt_money(base_fee, cur)
    km_txt = _fmt_money(km_fee, cur)
    return {
        "type": "section",
        "fields": [
            {"type": "mrkdwn", "text": f"*Delivery fee (total):*\n{delivery_txt}"},
            {"type": "mrkdwn", "text": f"*Base / per-km:*\n{base_txt} + {km_txt}"},
        ],
    }


def _payment_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    pay_method = _escape_mrkdwn(str(data.get("paymentMethod") or "—"))
    pay_status = _escape_mrkdwn(str(data.get("paymentStatus") or "—"))
    return {
        "type": "section",
        "fields": [
            {"type": "mrkdwn", "text": f"*Payment method:*\n{pay_method}"},
            {"type": "mrkdwn", "text": f"*Payment status:*\n{pay_status}"},
        ],
    }


def _items_and_context_blocks(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    items_block = _build_items_preview(list(data.get("orderItems") or []))
    oid = _escape_mrkdwn(str(data.get("orderId") or ""))
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Items:*\n{items_block}"}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Order id `{oid}`"}]},
    ]


def build_order_slack_payload(event_kind: str, data: Dict[str, Any]) -> Dict[str, Any]:
    cur = str(data.get("currency") or "USD")
    blocks: List[Dict[str, Any]] = [
        _title_block(event_kind),
        _customer_order_fields(data, cur),
        _business_address_fields(data),
        _delivery_fee_fields(data, cur),
        _payment_fields(data),
    ]
    blocks.extend(_items_and_context_blocks(data))
    return {"blocks": blocks}


def _handle_failed_attempt(
    attempt: int, status_code: int, body: str, exc: Exception | None
) -> bool:
    if attempt >= _MAX_RETRIES - 1:
        return False
    preview = (body or "")[:200]
    if exc is not None:
        _slack_log_error("Slack request error; retrying", exc, attempt=attempt + 1)
    else:
        _slack_log_error(
            "Slack POST failed; retrying",
            None,
            status=status_code,
            body_preview=preview,
            attempt=attempt + 1,
        )
    _sleep_before_retry(attempt)
    return True


def post_slack_order_alert(payload: Dict[str, Any], webhook_url: str) -> bool:
    url = webhook_url.strip()
    if not url:
        _slack_log_info("Slack webhook URL not set; skipping Slack notification")
        return False

    for attempt in range(_MAX_RETRIES):
        try:
            status_code, body = _post_once(url, payload)
            if _slack_success(status_code, body):
                _slack_log_info("Slack notification sent", attempt=attempt + 1)
                return True
            if status_code < 400:
                _slack_log_info("Slack accepted", status=status_code, body_preview=body[:200])
                return True
            if _should_retry_status(status_code) and _handle_failed_attempt(
                attempt, status_code, body, None
            ):
                continue
            _slack_log_error(
                "Slack POST failed (no retry)",
                None,
                status=status_code,
                body_preview=body[:200],
            )
            return False
        except requests.RequestException as exc:
            if _handle_failed_attempt(attempt, 0, "", exc):
                continue
            _slack_log_error("Slack request error (exhausted retries)", exc)
            return False
    return False


def send_slack_for_order_event(
    event_kind: str,
    order_data: Optional[Dict[str, Any]],
) -> bool:
    if not order_data:
        _slack_log_error("No order data for Slack notification", None)
        return False
    webhook = os.environ.get("SLACK_ORDER_WEBHOOK_URL", "").strip()
    if not webhook:
        _slack_log_info("SLACK_ORDER_WEBHOOK_URL unset; skipping Slack")
        return False
    payload = build_order_slack_payload(event_kind, order_data)
    return post_slack_order_alert(payload, webhook)
