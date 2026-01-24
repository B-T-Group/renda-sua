"""Mobile payment transactions Hasura operations."""
from typing import Optional, Dict, Any
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_transaction_by_id(
    transaction_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> Optional[Dict[str, Any]]:
    """
    Fetch a mobile_payment_transactions row by id.

    Returns:
        Dict with id, status, etc., or None if not found.
    """
    query = """
    query GetMobilePaymentTransaction($id: uuid!) {
      mobile_payment_transactions_by_pk(id: $id) {
        id
        reference
        status
        payment_entity
        entity_id
      }
    }
    """
    client = HasuraClient(
        HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret)
    )
    try:
        data = client.execute(query, {"id": transaction_id})
        row = data.get("mobile_payment_transactions_by_pk")
        if row:
            log_info(
                "Fetched mobile payment transaction",
                transaction_id=transaction_id,
                status=row.get("status"),
            )
        return row
    except Exception as e:
        log_error(
            "Failed to fetch mobile payment transaction",
            error=e,
            transaction_id=transaction_id,
        )
        raise


def update_transaction_status(
    transaction_id: str,
    status: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> bool:
    """Update mobile_payment_transactions status. Returns True on success."""
    mutation = """
    mutation UpdateMobilePaymentTransactionStatus($id: uuid!, $status: String!) {
      update_mobile_payment_transactions_by_pk(
        pk_columns: { id: $id }
        _set: { status: $status }
      ) {
        id
        status
      }
    }
    """
    client = HasuraClient(
        HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret)
    )
    try:
        data = client.execute(
            mutation,
            {"id": transaction_id, "status": status},
        )
        updated = data.get("update_mobile_payment_transactions_by_pk")
        if updated:
            log_info(
                "Updated mobile payment transaction status",
                transaction_id=transaction_id,
                status=status,
            )
            return True
        log_error(
            "Update mobile payment transaction returned no row",
            transaction_id=transaction_id,
        )
        return False
    except Exception as e:
        log_error(
            "Failed to update mobile payment transaction status",
            error=e,
            transaction_id=transaction_id,
        )
        raise
