"""Commission distribution and payment functions."""
from typing import Optional, List, Literal
from rendasua_core_packages.hasura_client import (
    log_info,
    log_error,
    get_account_by_user_and_currency,
    register_account_transaction,
)
from rendasua_core_packages.hasura_client.commission_service import (
    audit_commission_payout,
)
from .types import (
    CommissionOrder,
    CommissionBreakdown,
    BaseDeliveryFeeBreakdown,
    PerKmDeliveryFeeBreakdown,
    ItemCommissionBreakdown,
    OrderSubtotalBreakdown,
)
from .calculator import calculate_commissions
from rendasua_core_packages.models import User, Partner
from rendasua_core_packages.hasura_client.base import HasuraClient


def pay_commission(
    client: HasuraClient,
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
    commission_percentage: Optional[float] = None
) -> Optional[str]:
    """
    Pay commission to a recipient.
    
    Args:
        client: HasuraClient instance
        order: Commission order
        recipient_user_id: Recipient user ID
        recipient_type: Type of recipient
        commission_type: Type of commission
        amount: Commission amount
        currency: Currency code
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
            client._config.endpoint,
            client._config.admin_secret
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
        if not account.id:
            log_error(
                "Account ID is missing for commission payment",
                recipient_user_id=recipient_user_id,
                amount=amount,
                order_id=order.id,
            )
            return None
        transaction_id = register_account_transaction(
            account_id=account.id,
            amount=amount,
            transaction_type="deposit",
            memo=memo,
            reference_id=order.id,
            hasura_endpoint=client._config.endpoint,
            hasura_admin_secret=client._config.admin_secret,
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
            client=client,
            order_id=order.id,
            recipient_user_id=recipient_user_id,
            recipient_type=recipient_type,
            commission_type=commission_type,
            amount=amount,
            currency=currency,
            account_transaction_id=transaction_id,
            commission_percentage=commission_percentage,
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
    client: HasuraClient,
    order: CommissionOrder,
    breakdown: BaseDeliveryFeeBreakdown,
    rendasua_hq_user: User,
    partners: List[Partner],
) -> None:
    """
    Process base delivery fee commission payments.
    
    Args:
        client: HasuraClient instance
        order: Commission order
        breakdown: Base delivery fee breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
    """
    # Pay agent
    if order.assigned_agent and breakdown.agent > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=order.assigned_agent.user_id,
            recipient_type="agent",
            commission_type="base_delivery_fee",
            amount=breakdown.agent,
            currency=order.currency,
        )
    
    # Pay partners
    for partner in partners:
        partner_amount = (order.base_delivery_fee * partner.base_delivery_fee_commission) / 100
        if partner_amount > 0:
            pay_commission(
                client=client,
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="base_delivery_fee",
                amount=partner_amount,
                currency=order.currency,
                commission_percentage=partner.base_delivery_fee_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="base_delivery_fee",
            amount=breakdown.rendasua,
            currency=order.currency,
        )


def process_per_km_delivery_fee_commissions(
    client: HasuraClient,
    order: CommissionOrder,
    breakdown: PerKmDeliveryFeeBreakdown,
    rendasua_hq_user: User,
    partners: List[Partner],
) -> None:
    """
    Process per-km delivery fee commission payments.
    
    Args:
        client: HasuraClient instance
        order: Commission order
        breakdown: Per-km delivery fee breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
    """
    # Pay agent
    if order.assigned_agent and breakdown.agent > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=order.assigned_agent.user_id,
            recipient_type="agent",
            commission_type="per_km_delivery_fee",
            amount=breakdown.agent,
            currency=order.currency,
        )
    
    # Pay partners
    for partner in partners:
        partner_amount = (order.per_km_delivery_fee * partner.per_km_delivery_fee_commission) / 100
        if partner_amount > 0:
            pay_commission(
                client=client,
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="per_km_delivery_fee",
                amount=partner_amount,
                currency=order.currency,
                commission_percentage=partner.per_km_delivery_fee_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="per_km_delivery_fee",
            amount=breakdown.rendasua,
            currency=order.currency,
        )


def process_item_commissions(
    client: HasuraClient,
    order: CommissionOrder,
    breakdown: ItemCommissionBreakdown,
    rendasua_hq_user: User,
    partners: List[Partner],
) -> None:
    """
    Process item commission payments.
    
    Args:
        client: HasuraClient instance
        order: Commission order
        breakdown: Item commission breakdown
        rendasua_hq_user: RendaSua HQ user
        partners: List of active partners
    """
    # Pay partners
    for partner in partners:
        # Calculate RendaSua's item amount (5% of subtotal)
        rendasua_item_amount = (order.subtotal * 5.0) / 100
        partner_amount = (rendasua_item_amount * partner.item_commission) / 100
        if partner_amount > 0:
            pay_commission(
                client=client,
                order=order,
                recipient_user_id=partner.user_id,
                recipient_type="partner",
                commission_type="item_sale",
                amount=partner_amount,
                currency=order.currency,
                commission_percentage=partner.item_commission,
            )
    
    # Pay RendaSua HQ
    if breakdown.rendasua > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=rendasua_hq_user.id,
            recipient_type="rendasua",
            commission_type="item_sale",
            amount=breakdown.rendasua,
            currency=order.currency,
        )


def process_order_subtotal_payment(
    client: HasuraClient,
    order: CommissionOrder,
    breakdown: OrderSubtotalBreakdown,
) -> None:
    """
    Process order subtotal payment to business.
    
    Args:
        client: HasuraClient instance
        order: Commission order
        breakdown: Order subtotal breakdown
    """
    if breakdown.business > 0:
        pay_commission(
            client=client,
            order=order,
            recipient_user_id=order.business_user_id,
            recipient_type="business",
            commission_type="order_subtotal",
            amount=breakdown.business,
            currency=order.currency,
        )


def distribute_commissions(
    client: HasuraClient,
    order_id: str
) -> dict:
    """
    Main commission distribution function.
    
    Args:
        client: HasuraClient instance
        order_id: Order ID to distribute commissions for
        
    Returns:
        Dictionary with success status and details
    """
    try:
        log_info("Starting commission distribution", order_id=order_id)
        
        # Import here to avoid circular imports
        from rendasua_core_packages.hasura_client.commission_service import (
            get_commission_order,
            get_commission_configs,
            get_active_partners,
            get_rendasua_hq_user,
        )
        
        # Fetch order
        order = get_commission_order(client, order_id)
        if not order:
            return {
                "success": False,
                "error": f"Order {order_id} not found",
            }
        
        # Fetch commission configuration
        config = get_commission_configs(client)
        
        # Fetch active partners
        partners = get_active_partners(client)
        
        # Fetch RendaSua HQ user
        rendasua_hq_user = get_rendasua_hq_user(client)
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
            client,
            order,
            breakdown.base_delivery_fee,
            rendasua_hq_user,
            partners,
        )
        
        # Process per-km delivery fee commissions
        process_per_km_delivery_fee_commissions(
            client,
            order,
            breakdown.per_km_delivery_fee,
            rendasua_hq_user,
            partners,
        )
        
        # Process item commissions
        process_item_commissions(
            client,
            order,
            breakdown.item_commission,
            rendasua_hq_user,
            partners,
        )
        
        # Process order subtotal payment
        process_order_subtotal_payment(
            client,
            order,
            breakdown.order_subtotal,
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

