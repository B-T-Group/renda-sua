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


@dataclass
class SQSEventMessage:
    """SQS event message format."""
    eventType: str  # order.created, order.completed, order.status.updated
    orderId: str
    timestamp: str
    status: Optional[str] = None  # Only for order.status.updated

