"""
Wait-handler Lambda: generic handler invoked by Step Functions after a wait.

Receives { event_type, payload, run_at }. Implements payment-timeout logic for
order.created and order.claim_initiated.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
from rendasua_core_packages.hasura_client.mobile_payment_transactions_service import (
    get_transaction_by_id,
    update_transaction_status,
)
from rendasua_core_packages.hasura_client.orders_service import cancel_order
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


def _send_order_cancelled_sqs(
    order_id: str,
    queue_url: str,
) -> bool:
    """Send order.cancelled message to SQS. cancelledBy=system, previousStatus=pending_payment."""
    msg = {
        "eventType": "order.cancelled",
        "orderId": order_id,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "cancelledBy": "system",
        "previousStatus": "pending_payment",
        "orderStatus": "cancelled",
    }
    try:
        sqs = boto3.client("sqs")
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(msg),
            MessageGroupId="order-status-events",
        )
        log_info("Sent order.cancelled to SQS", order_id=order_id)
        return True
    except Exception as e:
        log_error("Failed to send order.cancelled to SQS", error=e, order_id=order_id)
        return False


def _handle_order_created(
    payload: Dict[str, Any],
    hasura_endpoint: str,
    hasura_admin_secret: str,
    queue_url: Optional[str],
    order_id: str,
    transaction_id: str,
) -> Dict[str, Any]:
    """Cancel order (mirror cancelOrder): cancel_order + SQS."""
    log_info("Processing order.created timeout", order_id=order_id, transaction_id=transaction_id)
    result = cancel_order(
        order_id,
        "Order cancelled due to payment timeout",
        hasura_endpoint,
        hasura_admin_secret,
    )
    if not result.get("success"):
        return {"success": False, "error": result.get("error", "Failed to cancel order")}
    if queue_url:
        _send_order_cancelled_sqs(order_id, queue_url)
    else:
        log_info("ORDER_STATUS_QUEUE_URL not set, skipping SQS", order_id=order_id)
    return {"success": True, "event_type": "order.created", "order_id": order_id}


def _handle_order_claim_initiated(
    payload: Dict[str, Any],
    order_id: str,
    transaction_id: str,
) -> Dict[str, Any]:
    """Only cancel transaction; no order changes, no SQS."""
    log_info(
        "Claim timeout: transaction cancelled only",
        order_id=order_id,
        transaction_id=transaction_id,
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
        run_at = event.get("run_at")

        if not event_type or not payload:
            log_error("Missing event_type or payload", event_type=event_type)
            return {"success": False, "error": "Missing event_type or payload"}

        order_id = payload.get("order_id")
        transaction_id = payload.get("transaction_id")
        if not order_id or not transaction_id:
            log_error("Missing order_id or transaction_id in payload", payload=payload)
            return {"success": False, "error": "Missing order_id or transaction_id"}

        environment = os.environ.get("ENVIRONMENT", "development")
        hasura_endpoint, hasura_admin_secret = _get_hasura_config(environment)
        queue_url = os.environ.get("ORDER_STATUS_QUEUE_URL")

        tx = get_transaction_by_id(
            transaction_id, hasura_endpoint, hasura_admin_secret
        )
        if not tx:
            log_error("Transaction not found", transaction_id=transaction_id)
            return {"success": False, "error": "Transaction not found"}

        status = tx.get("status")
        log_info(
            "Fetched transaction",
            transaction_id=transaction_id,
            status=status,
        )
        if status != "pending":
            log_info(
                "Transaction no longer pending, skipping",
                transaction_id=transaction_id,
                status=status,
            )
            return {"success": True, "skipped": True, "status": status}

        log_info("Cancelling pending transaction", transaction_id=transaction_id)
        update_transaction_status(
            transaction_id, "cancelled", hasura_endpoint, hasura_admin_secret
        )

        if event_type == "order.created":
            return _handle_order_created(
                payload,
                hasura_endpoint,
                hasura_admin_secret,
                queue_url,
                order_id,
                transaction_id,
            )
        if event_type == "order.claim_initiated":
            return _handle_order_claim_initiated(
                payload, order_id, transaction_id
            )

        log_error("Unknown event_type", event_type=event_type)
        return {"success": False, "error": f"Unknown event_type: {event_type}"}

    except Exception as e:
        log_error("Unhandled error in wait-handler", error=e)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
