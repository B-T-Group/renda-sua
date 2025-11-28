"""Data models for commission handler."""
from typing import Optional, Literal
from dataclasses import dataclass


@dataclass
class Partner:
    """Partner model with commission percentages."""
    id: str
    user_id: str
    company_name: str
    base_delivery_fee_commission: float
    per_km_delivery_fee_commission: float
    item_commission: float
    is_active: bool
    created_at: str
    updated_at: str


@dataclass
class CommissionConfig:
    """Commission configuration values from application_configurations."""
    rendasua_item_commission_percentage: float
    unverified_agent_base_delivery_commission: float
    verified_agent_base_delivery_commission: float
    unverified_agent_per_km_delivery_commission: float
    verified_agent_per_km_delivery_commission: float


@dataclass
class BaseDeliveryFeeBreakdown:
    """Base delivery fee commission breakdown."""
    agent: float
    partner: float
    rendasua: float


@dataclass
class PerKmDeliveryFeeBreakdown:
    """Per-km delivery fee commission breakdown."""
    agent: float
    partner: float
    rendasua: float


@dataclass
class ItemCommissionBreakdown:
    """Item commission breakdown."""
    partner: float
    rendasua: float


@dataclass
class OrderSubtotalBreakdown:
    """Order subtotal breakdown."""
    business: float
    rendasua: float


@dataclass
class CommissionBreakdown:
    """Complete commission breakdown structure."""
    base_delivery_fee: BaseDeliveryFeeBreakdown
    per_km_delivery_fee: PerKmDeliveryFeeBreakdown
    item_commission: ItemCommissionBreakdown
    order_subtotal: OrderSubtotalBreakdown


@dataclass
class CommissionPayout:
    """Individual commission payout record."""
    recipient_user_id: str
    recipient_type: Literal['partner', 'rendasua', 'agent', 'business']
    commission_type: Literal[
        'base_delivery_fee',
        'per_km_delivery_fee',
        'item_sale',
        'order_subtotal'
    ]
    amount: float
    currency: str
    commission_percentage: Optional[float] = None


@dataclass
class RendasuaHQUser:
    """RendaSua HQ user model."""
    id: str
    user_type_id: str
    identifier: str
    first_name: str
    last_name: str
    email: str
    phone_number: str


@dataclass
class CommissionAssignedAgent:
    """Assigned agent model with verification status for commission processing."""
    user_id: str
    is_verified: bool


@dataclass
class CommissionOrder:
    """Extended order model for commission processing."""
    id: str
    order_number: str
    base_delivery_fee: float
    per_km_delivery_fee: float
    subtotal: float
    currency: str
    assigned_agent_id: Optional[str]
    assigned_agent: Optional[CommissionAssignedAgent]
    business_user_id: str

