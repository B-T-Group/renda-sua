"""Data models for order status handler."""
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class Coordinates:
    """Geographic coordinates."""
    latitude: float
    longitude: float


@dataclass
class Address:
    """Address model."""
    id: str
    address_line_1: str
    address_line_2: Optional[str]
    city: str
    state: str
    postal_code: Optional[str]
    country: str
    latitude: Optional[float]
    longitude: Optional[float]

    def format_full_address(self) -> str:
        """Format full address string."""
        parts = [
            self.address_line_1,
            self.address_line_2,
            self.city,
            self.state,
            self.postal_code,
            self.country,
        ]
        return ", ".join(part for part in parts if part)


@dataclass
class BusinessLocation:
    """Business location model."""
    id: str
    name: str
    address: Address


@dataclass
class AgentLocation:
    """Agent location model."""
    agent_id: str
    latitude: float
    longitude: float
    created_at: str
    agent: dict  # Contains user info with email, first_name, last_name


@dataclass
class Order:
    """Order model."""
    id: str
    order_number: str
    business_location: BusinessLocation
    current_status: Optional[str] = None


@dataclass
class Client:
    """Client model."""
    user_id: str


@dataclass
class Business:
    """Business model."""
    user_id: str


@dataclass
class AssignedAgent:
    """Assigned agent model."""
    user_id: str
    is_verified: Optional[bool] = None


@dataclass
class CompleteOrder:
    """Complete order model with all fields needed for payment processing."""
    id: str
    order_number: str
    total_amount: float
    currency: str
    client_id: str
    client: Client
    business: Business
    assigned_agent_id: Optional[str]
    assigned_agent: Optional[AssignedAgent]


@dataclass
class OrderHold:
    """Order hold model."""
    id: str
    order_id: str
    client_id: str
    agent_id: Optional[str]
    client_hold_amount: float
    agent_hold_amount: float
    delivery_fees: float
    currency: str
    status: str
    created_at: str
    updated_at: str


@dataclass
class Account:
    """Account model."""
    id: str
    user_id: str
    currency: str
    available_balance: float
    withheld_balance: float
    total_balance: float
    is_active: bool


@dataclass
class BalanceUpdate:
    """Balance update model."""
    available: float
    withheld: float


@dataclass
class TransactionInfo:
    """Transaction info model."""
    isCredit: bool
    balanceUpdate: BalanceUpdate


@dataclass
class SQSEventMessage:
    """SQS event message format."""
    eventType: str  # order.created, order.completed, order.status.updated, order.cancelled
    orderId: str
    timestamp: str
    status: Optional[str] = None  # Only for order.status.updated
    cancelledBy: Optional[str] = None  # Only for order.cancelled
    cancellationReason: Optional[str] = None  # Only for order.cancelled
    previousStatus: Optional[str] = None  # Only for order.cancelled
    orderStatus: Optional[str] = None  # Only for order.cancelled

