"""Commission distribution and payment functions."""
from typing import Optional, List, Literal
import sys
import os

# Add parent directory to path to import from hasura_client
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hasura_client import (
    log_info,
    log_error,
    get_account_by_user_and_currency,
    register_account_transaction,
)
from .models import (
    CommissionOrder,
    CommissionBreakdown,
    Partner,
    RendasuaHQUser,
    BaseDeliveryFeeBreakdown,
    PerKmDeliveryFeeBreakdown,
    ItemCommissionBreakdown,
    OrderSubtotalBreakdown,
)
from .hasura_queries import audit_commission_payout


def pay_commission(
    order: CommissionOrder,
    recipient_user_id: str,
    recipient_type: Literal['partner', 'rendasua', 'agent', 'business'],
    commission_type: Literal[
        'base_delivery_fee',
        'per_km_delivery_fee',
        'item_sale',
        'order_subtotal'
    ],
    amount: float,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    commission_percentage: Optional[float] = None
) -> Optional[str]:
    """
    Pay commission to a recipient.
    
    Args:
        order: Commission order
        recipient_user_id: Recipient user ID
        recipient_type: Type of recipient
        commission_type: Type of commission
        amount: Commission amount
        currency: Currency code
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        commission_percentage: Optional commission percentage
        
    Returns:
        Account transaction ID if successful, None otherwise
    """
    try:
        # Validate amount
        if amount <= 0:
            log_info(
                "Skipping commission payment - amount is zero or negative",
                recipient_user_id=recipient_user_id,
                amount=amount,
            )
            return None
        
        # Get recipient account
        account = get_account_by_user_and_currency(
            recipient_user_id,
            currency,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not account:
            log_error(
                "Account not found for commission payment",
                recipient_user_id=recipient_user_id,
                currency=currency,
                order_id=order.id,
            )
            return None
        
        # Create account transaction (deposit)
        memo = f"Commission payment for order {order.order_number} ({commission_type})"
        transaction_id = register_account_transaction(
            account_id=account.id,
            amount=amount,
            transaction_type="deposit",
            memo=memo,
            reference_id=order.id,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )
        
        if not transaction_id:
            log_error(
                "Failed to register account transaction for commission",
                recipient_user_id=recipient_user_id,
                amount=amount,
                order_id=order.id,
            )
            return None
        
        # Audit commission payout
        audit_commission_payout(
            order_id=order.id,
            recipient_user_id=recipient_user_id,
            recipient_type=recipient_type,
            commission_type=commission_type,
            amount=amount,
            currency=currency,
            account_transaction_id=transaction_id,
            commission_percentage=commission_percentage,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )
        
        log_info(
            "Commission paid successfully",
            recipient_type=recipient_type,
            recipient_user_id=recipient_user_id,
            amount=amount,
            currency=currency,
            order_id=order.id,
            transaction_id=transaction_id,
        )
        
        return transaction_id
        
    except Exception as e:
        log_error(
            "Error paying commission",
            error=e,
            recipient_user_id=recipient_user_id,
            recipient_type=recipient_type,
            amount=amount,
            order_id=order.id,
        )
        return None


def process_base_delivery_fee_commissions(
    order: CommissionOrder,
    breakdown: BaseDeliveryFeeBreakdown,
    rendasua_hq_user: RendasuaHQUser,
    partners: List[Partner],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> None:
    """
    Process base delivery fee commission payments.
    
    Args:
        order: Commission order
        breakdown: Base delivery fee breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
    """
    # Pay agent
    if order.assigned_agent and breakdown.agent > 0:
        pay_commission(
            order=order,
            recipient_user_id=order.assigned_agent.user_id,
            recipient_type="agent",
            commission_type="base_delivery_fee",
            amount=breakdown.agent,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )
    
    # Pay partners
    for partner in partners:
        partner_amount = (order.base_delivery_fee * partner.base_delivery_fee_commission) / 100
        if partner_amount > 0:
            pay_commission(
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="base_delivery_fee",
                amount=partner_amount,
                currency=order.currency,
                hasura_endpoint=hasura_endpoint,
                hasura_admin_secret=hasura_admin_secret,
                commission_percentage=partner.base_delivery_fee_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="base_delivery_fee",
            amount=breakdown.rendasua,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )


def process_per_km_delivery_fee_commissions(
    order: CommissionOrder,
    breakdown: PerKmDeliveryFeeBreakdown,
    rendasua_hq_user: RendasuaHQUser,
    partners: List[Partner],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> None:
    """
    Process per-km delivery fee commission payments.
    
    Args:
        order: Commission order
        breakdown: Per-km delivery fee breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
    """
    # Pay agent
    if order.assigned_agent and breakdown.agent > 0:
        pay_commission(
            order=order,
            recipient_user_id=order.assigned_agent.user_id,
            recipient_type="agent",
            commission_type="per_km_delivery_fee",
            amount=breakdown.agent,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )
    
    # Pay partners
    for partner in partners:
        partner_amount = (order.per_km_delivery_fee * partner.per_km_delivery_fee_commission) / 100
        if partner_amount > 0:
            pay_commission(
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="per_km_delivery_fee",
                amount=partner_amount,
                currency=order.currency,
                hasura_endpoint=hasura_endpoint,
                hasura_admin_secret=hasura_admin_secret,
                commission_percentage=partner.per_km_delivery_fee_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="per_km_delivery_fee",
            amount=breakdown.rendasua,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )


def process_item_commissions(
    order: CommissionOrder,
    breakdown: ItemCommissionBreakdown,
    rendasua_hq_user: RendasuaHQUser,
    partners: List[Partner],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> None:
    """
    Process item commission payments.
    
    Args:
        order: Commission order
        breakdown: Item commission breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
    """
    # Pay partners
    for partner in partners:
        # Calculate RendaSua's item amount (5% of subtotal)
        rendasua_item_amount = (order.subtotal * 5.0) / 100
        partner_amount = (rendasua_item_amount * partner.item_commission) / 100
        if partner_amount > 0:
            pay_commission(
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="item_sale",
                amount=partner_amount,
                currency=order.currency,
                hasura_endpoint=hasura_endpoint,
                hasura_admin_secret=hasura_admin_secret,
                commission_percentage=partner.item_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="item_sale",
            amount=breakdown.rendasua,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )


def process_order_subtotal_payment(
    order: CommissionOrder,
    breakdown: OrderSubtotalBreakdown,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> None:
    """
    Process order subtotal payment to business.
    
    Args:
        order: Commission order
        breakdown: Order subtotal breakdown
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
    """
    if breakdown.business > 0:
        pay_commission(
            order=order,
            recipient_user_id=order.business_user_id,
            recipient_type="business",
            commission_type="order_subtotal",
            amount=breakdown.business,
            currency=order.currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
        )


def distribute_commissions(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> dict:
    """
    Main commission distribution function.
    
    Args:
        order_id: Order ID to distribute commissions for
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Dictionary with success status and details
    """
    try:
        log_info("Starting commission distribution", order_id=order_id)
        
        # Import here to avoid circular imports
        from .hasura_queries import (
            get_commission_order,
            get_commission_configs,
            get_active_partners,
            get_rendasua_hq_user,
        )
        from .calculator import calculate_commissions
        
        # Fetch order
        order = get_commission_order(order_id, hasura_endpoint, hasura_admin_secret)
        if not order:
            return {
                "success": False,
                "error": f"Order {order_id} not found",
            }
        
        # Fetch commission configuration
        config = get_commission_configs(hasura_endpoint, hasura_admin_secret)
        
        # Fetch active partners
        partners = get_active_partners(hasura_endpoint, hasura_admin_secret)
        
        # Fetch RendaSua HQ user
        rendasua_hq_user = get_rendasua_hq_user(hasura_endpoint, hasura_admin_secret)
        if not rendasua_hq_user:
            return {
                "success": False,
                "error": "RendaSua HQ user not found",
            }
        
        # Calculate commission breakdown
        breakdown = calculate_commissions(order, config, partners)
        
        log_info(
            "Commission breakdown calculated",
            order_id=order_id,
            order_number=order.order_number,
        )
        
        # Process base delivery fee commissions
        process_base_delivery_fee_commissions(
            order,
            breakdown.base_delivery_fee,
            rendasua_hq_user,
            partners,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        # Process per-km delivery fee commissions
        process_per_km_delivery_fee_commissions(
            order,
            breakdown.per_km_delivery_fee,
            rendasua_hq_user,
            partners,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        # Process item commissions
        process_item_commissions(
            order,
            breakdown.item_commission,
            rendasua_hq_user,
            partners,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        # Process order subtotal payment
        process_order_subtotal_payment(
            order,
            breakdown.order_subtotal,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        log_info(
            "Commission distribution completed successfully",
            order_id=order_id,
            order_number=order.order_number,
        )
        
        return {
            "success": True,
            "message": f"Commissions distributed for order {order.order_number}",
            "order_id": order_id,
        }
        
    except Exception as e:
        log_error(
            "Error distributing commissions",
            error=e,
            order_id=order_id,
        )
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }

