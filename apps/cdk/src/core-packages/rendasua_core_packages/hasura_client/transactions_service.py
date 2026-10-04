"""Transaction-related Hasura operations."""
from typing import Dict, Any, Optional
from .logging import log_info, log_error
from .accounts_service import register_account_transaction
from rendasua_core_packages.utilities.cancellation_fee import split_cancellation_fee


def register_cancellation_fee_transactions(
    order_id: str,
    order_number: str,
    client_account_id: str,
    business_account_id: str,
    fee_amount: float,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    platform_account_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Register cancellation fee transactions: debit the client the full fee,
    credit the merchant floor(half), and credit the platform the remainder.
    
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
    merchant_share, platform_share = split_cancellation_fee(fee_amount, currency)
    if platform_share > 0 and not platform_account_id:
        log_error("Platform account not found for cancellation fee", order_id=order_id)
        return {"success": False, "error": "Platform account not found"}

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

    business_transaction_id = _credit_share(
        business_account_id, merchant_share, order_id, order_number,
        f"Cancellation fee received for order {order_number}",
        hasura_endpoint, hasura_admin_secret, "business",
    )
    if merchant_share > 0 and not business_transaction_id:
        return {"success": False, "error": "Failed to credit business account"}

    platform_transaction_id = _credit_share(
        platform_account_id, platform_share, order_id, order_number,
        f"Cancellation fee platform share for order {order_number}",
        hasura_endpoint, hasura_admin_secret, "platform",
    )
    if platform_share > 0 and not platform_transaction_id:
        return {"success": False, "error": "Failed to credit platform account"}

    return {
        "success": True,
        "client_transaction_id": client_transaction_id,
        "business_transaction_id": business_transaction_id,
        "platform_transaction_id": platform_transaction_id,
        "merchant_share": merchant_share,
        "platform_share": platform_share,
    }


def _credit_share(
    account_id: Optional[str],
    amount: float,
    order_id: str,
    order_number: str,
    memo: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    label: str,
):
    if not (amount > 0) or not account_id:
        return None
    transaction_id = register_account_transaction(
        account_id, amount, "deposit", memo, order_id, hasura_endpoint, hasura_admin_secret
    )
    if not transaction_id:
        log_error(f"Failed to register {label} cancellation fee transaction", order_id=order_id)
        return None
    log_info(
        f"{label} cancellation fee transaction registered",
        order_id=order_id,
        transaction_id=transaction_id,
        order_number=order_number,
        amount=amount,
    )
    return transaction_id

