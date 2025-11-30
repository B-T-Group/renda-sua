"""
Pure commission calculation functions.

These are intentionally stateless and side-effect free so they can be
reused safely from multiple Lambdas.
"""

from typing import List

from .types import (
    CommissionConfig,
    Partner,
    CommissionOrder,
    CommissionBreakdown,
    BaseDeliveryFeeBreakdown,
    PerKmDeliveryFeeBreakdown,
    ItemCommissionBreakdown,
    OrderSubtotalBreakdown,
)


def _sum_partner_commission(amount: float, partners: List[Partner], attr: str) -> float:
    value = 0.0
    for partner in partners:
        percentage = getattr(partner, attr, 0.0)
        value += (amount * percentage) / 100
    return value


def calculate_base_delivery_fee_commissions(
    base_delivery_fee: float,
    is_agent_verified: bool,
    config: CommissionConfig,
    partners: List[Partner],
) -> BaseDeliveryFeeBreakdown:
    agent_commission = (
        config.verified_agent_base_delivery_commission
        if is_agent_verified
        else config.unverified_agent_base_delivery_commission
    )
    agent_amount = (base_delivery_fee * agent_commission) / 100
    partner_amount = _sum_partner_commission(
        base_delivery_fee,
        partners,
        "base_delivery_fee_commission",
    )
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
    partners: List[Partner],
) -> PerKmDeliveryFeeBreakdown:
    agent_commission = (
        config.verified_agent_per_km_delivery_commission
        if is_agent_verified
        else config.unverified_agent_per_km_delivery_commission
    )
    agent_amount = (per_km_delivery_fee * agent_commission) / 100
    partner_amount = _sum_partner_commission(
        per_km_delivery_fee,
        partners,
        "per_km_delivery_fee_commission",
    )
    rendasua_amount = per_km_delivery_fee - agent_amount - partner_amount
    return PerKmDeliveryFeeBreakdown(
        agent=agent_amount,
        partner=partner_amount,
        rendasua=rendasua_amount,
    )


def calculate_item_commission(
    subtotal: float,
    rendasua_item_commission_percentage: float,
    partners: List[Partner],
) -> ItemCommissionBreakdown:
    rendasua_item_amount = (subtotal * rendasua_item_commission_percentage) / 100
    partner_amount = _sum_partner_commission(
        rendasua_item_amount,
        partners,
        "item_commission",
    )
    rendasua_amount = rendasua_item_amount - partner_amount
    return ItemCommissionBreakdown(partner=partner_amount, rendasua=rendasua_amount)


def calculate_order_subtotal_breakdown(
    subtotal: float,
    rendasua_item_commission_percentage: float,
) -> OrderSubtotalBreakdown:
    rendasua_amount = (subtotal * rendasua_item_commission_percentage) / 100
    business_amount = subtotal - rendasua_amount
    return OrderSubtotalBreakdown(business=business_amount, rendasua=rendasua_amount)


def calculate_commissions(
    order: CommissionOrder,
    config: CommissionConfig,
    partners: List[Partner],
) -> CommissionBreakdown:
    is_verified = bool(order.assigned_agent and order.assigned_agent.is_verified)
    base_delivery = calculate_base_delivery_fee_commissions(
        order.base_delivery_fee,
        is_verified,
        config,
        partners,
    )
    per_km_delivery = calculate_per_km_delivery_fee_commissions(
        order.per_km_delivery_fee,
        is_verified,
        config,
        partners,
    )
    item_commission = calculate_item_commission(
        order.subtotal,
        config.rendasua_item_commission_percentage,
        partners,
    )
    subtotal_breakdown = calculate_order_subtotal_breakdown(
        order.subtotal,
        config.rendasua_item_commission_percentage,
    )
    return CommissionBreakdown(
        base_delivery_fee=base_delivery,
        per_km_delivery_fee=per_km_delivery,
        item_commission=item_commission,
        order_subtotal=subtotal_breakdown,
    )


