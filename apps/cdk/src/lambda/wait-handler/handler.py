"""
Wait-handler Lambda: generic handler invoked by Step Functions after a wait.

Receives { event_type, payload, run_at }. Implements payment-timeout logic for
order.created, order.pending_payment_timeout, and order.payment_failed,
merchant acceptance SLA callbacks, and agent-dispatch round escalation/exhaustion.
"""
import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

import boto3
from rendasua_core_packages.hasura_client.mobile_payment_transactions_service import (
    get_transaction_by_id,
    update_transaction_status,
)
from rendasua_core_packages.secrets_manager import get_hasura_admin_secret


def log_info(message: str, **kwargs: Any) -> None:
    """Structured info log."""
    parts = [f"{k}={v}" for k, v in kwargs.items()]
    print(f"[INFO] {message}" + (f" | {' '.join(parts)}" if parts else ""))


def log_error(message: str, error: Optional[Exception] = None, **kwargs: Any) -> None:
    """Structured error log."""
    parts = [f"{k}={v}" for k, v in kwargs.items()]
    err = f" | error={error!r}" if error else ""
    print(f"[ERROR] {message}" + (f" | {' '.join(parts)}" if parts else "") + err)


def _get_hasura_config(environment: str) -> tuple[str, str]:
    """Return (endpoint, admin_secret)."""
    endpoint = os.environ.get("GRAPHQL_ENDPOINT", "")
    if not endpoint:
        raise ValueError("GRAPHQL_ENDPOINT not set")
    secret = get_hasura_admin_secret(environment)
    return endpoint, secret


def _call_backend_internal(
    path: str,
    body: Dict[str, Any],
    log_label: str,
) -> Dict[str, Any]:
    """POST a Nest internal orders endpoint."""
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        log_error("BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing")
        return {"success": False, "error": "backend internal API not configured"}
    url = f"{base}/api/orders/internal/{path}"
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-rendasua-internal-key": key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            log_info(f"{log_label} OK", path=path, status=resp.status)
            try:
                return json.loads(raw) if raw else {"success": True}
            except json.JSONDecodeError:
                return {"success": True}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        log_error(f"{log_label} HTTP error", error=e, path=path, body=err_body)
        return {"success": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        log_error(f"{log_label} failed", error=e, path=path)
        return {"success": False, "error": str(e)}


def _call_backend_cancel_unpaid(
    order_id: str,
    reason: str,
) -> Dict[str, Any]:
    """POST Nest cancel-unpaid (CAS + Stripe release + inventory restore)."""
    return _call_backend_internal(
        "cancel-unpaid",
        {"orderId": order_id, "reason": reason},
        "Cancel unpaid",
    )


def _cancel_momo_tx_if_pending(
    transaction_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> None:
    """Mark mobile_payment_transactions row cancelled when still pending."""
    tx = get_transaction_by_id(
        transaction_id, hasura_endpoint, hasura_admin_secret
    )
    if not tx:
        log_error("Transaction not found for MoMo cancel", transaction_id=transaction_id)
        return
    status = tx.get("status")
    if status != "pending":
        log_info(
            "MoMo tx not pending; skip provider cancel",
            transaction_id=transaction_id,
            status=status,
        )
        return
    log_info("Cancelling pending MoMo transaction", transaction_id=transaction_id)
    update_transaction_status(
        transaction_id, "cancelled", hasura_endpoint, hasura_admin_secret
    )


def _handle_unpaid_order_timeout(
    order_id: str,
    reason: str,
    transaction_id: Optional[str],
    hasura_endpoint: str,
    hasura_admin_secret: str,
    event_type: str,
) -> Dict[str, Any]:
    """
    Nest cancel first; only cancel MoMo tx when Nest reports cancelled.
    If Nest skipped (already paid / no longer pending_payment), leave tx alone.
    """
    log_info(
        "Processing unpaid order timeout via Nest",
        order_id=order_id,
        reason=reason,
        event_type=event_type,
    )
    result = _call_backend_cancel_unpaid(order_id, reason)
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Nest cancel-unpaid failed"),
        }
    if result.get("cancelled"):
        if transaction_id:
            _cancel_momo_tx_if_pending(
                transaction_id, hasura_endpoint, hasura_admin_secret
            )
        return {
            "success": True,
            "event_type": event_type,
            "order_id": order_id,
            "cancelled": True,
        }
    return {
        "success": True,
        "event_type": event_type,
        "order_id": order_id,
        "skipped": True,
        "reason": result.get("reason", "not_cancelled"),
    }


def _handle_order_claim_initiated(
    payload: Dict[str, Any],
    order_id: str,
    transaction_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> Dict[str, Any]:
    """Only cancel transaction; no order changes."""
    log_info(
        "Claim timeout: transaction cancelled only",
        order_id=order_id,
        transaction_id=transaction_id,
    )
    _cancel_momo_tx_if_pending(
        transaction_id, hasura_endpoint, hasura_admin_secret
    )
    return {
        "success": True,
        "event_type": "order.claim_initiated",
        "order_id": order_id,
        "transaction_id": transaction_id,
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Entry point. Input: { event_type, payload, run_at }.
    """
    log_info(
        "Wait-handler invoked",
        request_id=context.aws_request_id if context else "unknown",
        event_type=event.get("event_type"),
        payload=event.get("payload"),
        run_at=event.get("run_at"),
    )
    try:
        event_type = event.get("event_type")
        payload = event.get("payload") or {}

        if not event_type or not payload:
            log_error("Missing event_type or payload", event_type=event_type)
            return {"success": False, "error": "Missing event_type or payload"}

        order_id = payload.get("order_id")
        transaction_id = payload.get("transaction_id")
        if not order_id:
            log_error("Missing order_id in payload", payload=payload)
            return {"success": False, "error": "Missing order_id"}

        environment = os.environ.get("ENVIRONMENT", "development")
        hasura_endpoint, hasura_admin_secret = _get_hasura_config(environment)

        if event_type == "order.acceptance_activate":
            return _call_backend_internal(
                "acceptance-activate",
                {"orderId": order_id},
                "Acceptance activate",
            )

        if event_type == "order.acceptance_deadline":
            return _call_backend_internal(
                "acceptance-deadline",
                {"orderId": order_id},
                "Acceptance deadline",
            )

        if event_type == "order.acceptance_reminder":
            return _call_backend_internal(
                "acceptance-reminder",
                {"orderId": order_id},
                "Acceptance reminder",
            )

        if event_type == "order.acceptance_grace_deadline":
            return _call_backend_internal(
                "acceptance-grace-deadline",
                {"orderId": order_id},
                "Acceptance grace deadline",
            )

        if event_type == "order.dispatch_round":
            return _call_backend_internal(
                "dispatch-round",
                {"orderId": order_id, "round": payload.get("round")},
                "Dispatch round",
            )

        if event_type == "order.payment_failed":
            return _handle_unpaid_order_timeout(
                order_id,
                "payment_failed_grace",
                transaction_id,
                hasura_endpoint,
                hasura_admin_secret,
                event_type,
            )

        if event_type == "order.pending_payment_timeout":
            return _handle_unpaid_order_timeout(
                order_id,
                "timeout",
                None,
                hasura_endpoint,
                hasura_admin_secret,
                event_type,
            )

        if event_type == "order.created":
            if not transaction_id:
                log_error("Missing transaction_id for order.created", payload=payload)
                return {"success": False, "error": "Missing transaction_id"}
            return _handle_unpaid_order_timeout(
                order_id,
                "timeout",
                transaction_id,
                hasura_endpoint,
                hasura_admin_secret,
                event_type,
            )

        if event_type == "order.claim_initiated":
            if not transaction_id:
                log_error("Missing transaction_id for claim", payload=payload)
                return {"success": False, "error": "Missing transaction_id"}
            return _handle_order_claim_initiated(
                payload,
                order_id,
                transaction_id,
                hasura_endpoint,
                hasura_admin_secret,
            )

        log_error("Unknown event_type", event_type=event_type)
        return {"success": False, "error": f"Unknown event_type: {event_type}"}

    except Exception as e:
        log_error("Unhandled error in wait-handler", error=e)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
