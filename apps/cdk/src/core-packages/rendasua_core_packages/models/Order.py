from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Address, Agent, Business, BusinessLocation, Client, DeliveryTimeWindow, OrderHold

class Order(BaseModel):
    actual_delivery_time: Optional[datetime.datetime] | None = None
    assigned_agent: Optional[Agent] | None = None
    assigned_agent_id: Optional[str] | None = None
    base_delivery_fee: float
    business: Optional[Business] | None = None
    business_id: str
    business_location: Optional[BusinessLocation] | None = None
    business_location_id: str
    client: Optional[Client] | None = None
    client_id: str
    created_at: Optional[datetime.datetime] | None = None
    currency: str
    current_status: str
    delivery_address: Optional[Address] | None = None
    delivery_address_id: str
    delivery_time_window: Optional[DeliveryTimeWindow] | None = None
    delivery_time_window_id: Optional[str] | None = None
    estimated_delivery_time: Optional[datetime.datetime] | None = None
    id: str
    order_hold: Optional[OrderHold] | None = None
    order_number: str
    payment_method: Optional[str] | None = None
    payment_status: Optional[str] | None = None
    per_km_delivery_fee: float
    preferred_delivery_time: Optional[datetime.datetime] | None = None
    requires_fast_delivery: bool
    special_instructions: Optional[str] | None = None
    subtotal: float
    tax_amount: float
    total_amount: float
    updated_at: Optional[datetime.datetime] | None = None
    verified_agent_delivery: Optional[bool] | None = None
