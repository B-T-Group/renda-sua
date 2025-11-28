"""Pure commission calculation functions (no side effects)."""
from typing import List
from .models import (
    CommissionConfig,
    Partner,
    CommissionOrder,
    CommissionBreakdown,
    BaseDeliveryFeeBreakdown,
    PerKmDeliveryFeeBreakdown,
    ItemCommissionBreakdown,
    OrderSubtotalBreakdown,
)


def calculate_base_delivery_fee_commissions(
    base_delivery_fee: float,
    is_agent_verified: bool,
    config: CommissionConfig,
    partners: List[Partner]
) -> BaseDeliveryFeeBreakdown:
    """
    Calculate base delivery fee commission breakdown.
    
    Args:
        base_delivery_fee: Base delivery fee amount
        is_agent_verified: Whether the agent is verified
        config: Commission configuration
        partners: List of active partners
        
    Returns:
        BaseDeliveryFeeBreakdown with agent, partner, and rendasua amounts
    """
    # Determine agent commission percentage
    agent_commission = (
        config.verified_agent_base_delivery_commission
        if is_agent_verified
        else config.unverified_agent_base_delivery_commission
    )
    
    # Calculate agent amount
    agent_amount = (base_delivery_fee * agent_commission) / 100
    
    # Calculate partner commissions
    partner_amount = 0.0
    for partner in partners:
        partner_amount += (base_delivery_fee * partner.base_delivery_fee_commission) / 100
    
    # Calculate RendaSua amount (remainder)
    rendasua_amount = base_delivery_fee - agent_amount - partner_amount
    
    return BaseDeliveryFeeBreakdown(
        agent=agent_amount,
        partner=partner_amount,
        rendasua=rendasua_amount,
    )


def calculate_per_km_delivery_fee_commissions(
    per_km_delivery_fee: float,
    is_agent_verified: bool,
    config: CommissionConfig,
    partners: List[Partner]
) -> PerKmDeliveryFeeBreakdown:
    """
    Calculate per-km delivery fee commission breakdown.
    
    Args:
        per_km_delivery_fee: Per-km delivery fee amount
        is_agent_verified: Whether the agent is verified
        config: Commission configuration
        partners: List of active partners
        
    Returns:
        PerKmDeliveryFeeBreakdown with agent, partner, and rendasua amounts
    """
    # Determine agent commission percentage
    agent_commission = (
        config.verified_agent_per_km_delivery_commission
        if is_agent_verified
        else config.unverified_agent_per_km_delivery_commission
    )
    
    # Calculate agent amount
    agent_amount = (per_km_delivery_fee * agent_commission) / 100
    
    # Calculate partner commissions
    partner_amount = 0.0
    for partner in partners:
        partner_amount += (per_km_delivery_fee * partner.per_km_delivery_fee_commission) / 100
    
    # Calculate RendaSua amount (remainder)
    rendasua_amount = per_km_delivery_fee - agent_amount - partner_amount
    
    return PerKmDeliveryFeeBreakdown(
        agent=agent_amount,
        partner=partner_amount,
        rendasua=rendasua_amount,
    )


def calculate_item_commission(
    subtotal: float,
    rendasua_item_commission_percentage: float,
    partners: List[Partner]
) -> ItemCommissionBreakdown:
    """
    Calculate item commission breakdown (on RendaSua's portion).
    
    Args:
        subtotal: Order subtotal amount
        rendasua_item_commission_percentage: RendaSua's commission percentage on items
        partners: List of active partners
        
    Returns:
        ItemCommissionBreakdown with partner and rendasua amounts
    """
    # Calculate RendaSua's portion of the subtotal
    rendasua_item_amount = (subtotal * rendasua_item_commission_percentage) / 100
    
    # Calculate partner commissions on RendaSua's portion
    partner_amount = 0.0
    for partner in partners:
        partner_amount += (rendasua_item_amount * partner.item_commission) / 100
    
    # Calculate RendaSua's final amount (after partner commissions)
    rendasua_amount = rendasua_item_amount - partner_amount
    
    return ItemCommissionBreakdown(
        partner=partner_amount,
        rendasua=rendasua_amount,
    )


def calculate_order_subtotal_breakdown(
    subtotal: float,
    rendasua_item_commission_percentage: float
) -> OrderSubtotalBreakdown:
    """
    Calculate order subtotal breakdown.
    
    Args:
        subtotal: Order subtotal amount
        rendasua_item_commission_percentage: RendaSua's commission percentage on items
        
    Returns:
        OrderSubtotalBreakdown with business and rendasua amounts
    """
    # Calculate RendaSua's commission on subtotal
    rendasua_amount = (subtotal * rendasua_item_commission_percentage) / 100
    
    # Calculate business amount (remainder)
    business_amount = subtotal - rendasua_amount
    
    return OrderSubtotalBreakdown(
        business=business_amount,
        rendasua=rendasua_amount,
    )


def calculate_commissions(
    order: CommissionOrder,
    config: CommissionConfig,
    partners: List[Partner]
) -> CommissionBreakdown:
    """
    Calculate complete commission breakdown for an order.
    
    Args:
        order: Commission order with all required fields
        config: Commission configuration
        partners: List of active partners
        
    Returns:
        CommissionBreakdown with all commission calculations
    """
    # Determine if agent is verified
    is_agent_verified = order.assigned_agent.is_verified if order.assigned_agent else False
    
    # Calculate base delivery fee commissions
    base_delivery_fee_breakdown = calculate_base_delivery_fee_commissions(
        order.base_delivery_fee,
        is_agent_verified,
        config,
        partners
    )
    
    # Calculate per-km delivery fee commissions
    per_km_delivery_fee_breakdown = calculate_per_km_delivery_fee_commissions(
        order.per_km_delivery_fee,
        is_agent_verified,
        config,
        partners
    )
    
    # Calculate item commission
    item_commission_breakdown = calculate_item_commission(
        order.subtotal,
        config.rendasua_item_commission_percentage,
        partners
    )
    
    # Calculate order subtotal breakdown
    order_subtotal_breakdown = calculate_order_subtotal_breakdown(
        order.subtotal,
        config.rendasua_item_commission_percentage
    )
    
    return CommissionBreakdown(
        base_delivery_fee=base_delivery_fee_breakdown,
        per_km_delivery_fee=per_km_delivery_fee_breakdown,
        item_commission=item_commission_breakdown,
        order_subtotal=order_subtotal_breakdown,
    )

