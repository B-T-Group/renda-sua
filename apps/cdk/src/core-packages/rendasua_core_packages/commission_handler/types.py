"""
Lightweight type definitions for commission calculations.

These mirror the structures used by the existing order-status Lambda but
are intentionally minimal so they can be reused safely from multiple
functions via the core-packages Lambda layer.
"""

from typing import Optional

from pydantic import BaseModel


class Partner(BaseModel):
    base_delivery_fee_commission: float
    per_km_delivery_fee_commission: float
    item_commission: float


class AssignedAgent(BaseModel):
    is_verified: bool = False


class CommissionOrder(BaseModel):
    base_delivery_fee: float
    per_km_delivery_fee: float
    subtotal: float
    assigned_agent: Optional[AssignedAgent] = None


class CommissionConfig(BaseModel):
    verified_agent_base_delivery_commission: float
    unverified_agent_base_delivery_commission: float
    verified_agent_per_km_delivery_commission: float
    unverified_agent_per_km_delivery_commission: float
    rendasua_item_commission_percentage: float


class BaseDeliveryFeeBreakdown(BaseModel):
    agent: float
    partner: float
    rendasua: float


class PerKmDeliveryFeeBreakdown(BaseModel):
    agent: float
    partner: float
    rendasua: float


class ItemCommissionBreakdown(BaseModel):
    partner: float
    rendasua: float


class OrderSubtotalBreakdown(BaseModel):
    business: float
    rendasua: float


class CommissionBreakdown(BaseModel):
    base_delivery_fee: BaseDeliveryFeeBreakdown
    per_km_delivery_fee: PerKmDeliveryFeeBreakdown
    item_commission: ItemCommissionBreakdown
    order_subtotal: OrderSubtotalBreakdown


