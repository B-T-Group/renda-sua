from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
import datetime
from enum import Enum
from pydantic import BaseModel
if TYPE_CHECKING:
    from . import Addresse, Agent, BusinessLocation, Businesse, Client, DeliveryTimeWindow, OrderHold

class Order(BaseModel):
    actual_delivery_time: Optional[datetime.datetime] | None = None
    assigned_agent: Optional[Agent] | None = None
    assigned_agent_id: Optional[str] | None = None
    base_delivery_fee: Optional[float] | None = None
    business: Optional[Businesse] | None = None
    business_id: Optional[str] | None = None
    business_location: Optional[BusinessLocation] | None = None
    business_location_id: Optional[str] | None = None
    client: Optional[Client] | None = None
    client_id: Optional[str] | None = None
    created_at: Optional[datetime.datetime] | None = None
    currency: Optional[str] | None = None
    current_status: Optional[str] | None = None
    delivery_address: Optional[Addresse] | None = None
    delivery_address_id: Optional[str] | None = None
    delivery_time_window: Optional[DeliveryTimeWindow] | None = None
    delivery_time_window_id: Optional[str] | None = None
    estimated_delivery_time: Optional[datetime.datetime] | None = None
    id: Optional[str] | None = None
    order_hold: Optional[OrderHold] | None = None
    order_number: Optional[str] | None = None
    payment_method: Optional[str] | None = None
    payment_status: Optional[str] | None = None
    per_km_delivery_fee: Optional[float] | None = None
    preferred_delivery_time: Optional[datetime.datetime] | None = None
    requires_fast_delivery: Optional[bool] | None = None
    special_instructions: Optional[str] | None = None
    subtotal: Optional[float] | None = None
    tax_amount: Optional[float] | None = None
    total_amount: Optional[float] | None = None
    updated_at: Optional[datetime.datetime] | None = None
    verified_agent_delivery: Optional[bool] | None = None
