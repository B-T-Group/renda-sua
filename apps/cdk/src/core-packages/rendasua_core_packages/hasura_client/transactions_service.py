"""Transaction-related Hasura operations."""
from typing import Dict, Any
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error
from .accounts_service import register_account_transaction


def register_cancellation_fee_transactions(
    order_id: str,
    order_number: str,
    client_account_id: str,
    business_account_id: str,
    fee_amount: float,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Dict[str, Any]:
    """
    Register cancellation fee transactions: debit client, credit business.
    
    Args:
        order_id: Order ID
        order_number: Order number for memo
        client_account_id: Client account ID (to debit)
        business_account_id: Business account ID (to credit)
        fee_amount: Cancellation fee amount
        currency: Currency code
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Dictionary with success status and transaction IDs
    """
    log_info(
        "Registering cancellation fee transactions",
        order_id=order_id,
        fee_amount=fee_amount,
        client_account_id=client_account_id,
        business_account_id=business_account_id,
    )
    
    # Debit client account
    client_debit_memo = f"Cancellation fee for order {order_number}"
    client_transaction_id = register_account_transaction(
        client_account_id,
        fee_amount,
        "fee",
        client_debit_memo,
        order_id,
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not client_transaction_id:
        log_error("Failed to register client cancellation fee transaction", order_id=order_id)
        return {"success": False, "error": "Failed to debit client account"}
    
    log_info("Client cancellation fee transaction registered", order_id=order_id, transaction_id=client_transaction_id)
    
    # Credit business account
    business_credit_memo = f"Cancellation fee received for order {order_number}"
    business_transaction_id = register_account_transaction(
        business_account_id,
        fee_amount,
        "deposit",
        business_credit_memo,
        order_id,
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not business_transaction_id:
        log_error("Failed to register business cancellation fee transaction", order_id=order_id)
        return {"success": False, "error": "Failed to credit business account"}
    
    log_info("Business cancellation fee transaction registered", order_id=order_id, transaction_id=business_transaction_id)
    
    return {
        "success": True,
        "client_transaction_id": client_transaction_id,
        "business_transaction_id": business_transaction_id,
    }

