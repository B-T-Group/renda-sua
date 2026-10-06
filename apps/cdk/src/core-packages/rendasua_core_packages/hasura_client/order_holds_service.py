"""Order hold-related Hasura operations."""
from typing import Optional
import datetime
from rendasua_core_packages.models import Order, OrderHold
from rendasua_core_packages.utilities import parse_datetime
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_order_hold(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[OrderHold]:
    """
    Return the order's existing hold row, or None when the order has none.

    Never creates a row. Raises on Hasura errors so callers fail closed instead of
    treating an outage as "nothing held".
    """
    query = """
    query GetExistingOrderHold($orderId: uuid!) {
      order_holds(where: { order_id: { _eq: $orderId } }, limit: 1) {
        id
        order_id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        created_at
        updated_at
      }
    }
    """
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    data = client.execute(query, {"orderId": order_id})
    rows = data.get("order_holds") or []
    if not rows:
        log_info("No order hold row for order", order_id=order_id)
        return None
    hold_data = rows[0]
    return OrderHold.model_construct(
        id=hold_data["id"],
        order_id=hold_data["order_id"],
        client_id=hold_data["client_id"],
        agent_id=hold_data.get("agent_id"),
        client_hold_amount=float(hold_data.get("client_hold_amount") or 0),
        agent_hold_amount=float(hold_data.get("agent_hold_amount") or 0),
        delivery_fees=float(hold_data.get("delivery_fees") or 0),
        currency=hold_data["currency"],
        status=hold_data["status"],
        created_at=parse_datetime(hold_data["created_at"]),
        updated_at=parse_datetime(hold_data["updated_at"]),
    )


def get_or_create_order_hold(
    order_id: str,
    order: Order,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[OrderHold]:
    """
    Get or create order hold for an order.
    
    Args:
        order_id: Order ID
        order: Order object
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        OrderHold object, None if error
    """
    # First, try to get existing order hold (omit settlement timestamp columns so older Hasura/DBs without migration still work)
    query = """
    query GetOrderHold($orderId: uuid!) {
      order_holds(where: { order_id: { _eq: $orderId } }) {
        id
        order_id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        created_at
        updated_at
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching order hold", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_holds_data = data.get("order_holds", [])
        
        if order_holds_data:
            hold_data = order_holds_data[0]
            order_hold = OrderHold(
                id=hold_data["id"],
                order_id=hold_data["order_id"],
                client_id=hold_data["client_id"],
                agent_id=hold_data.get("agent_id"),
                client_hold_amount=float(hold_data["client_hold_amount"]),
                agent_hold_amount=float(hold_data["agent_hold_amount"]),
                delivery_fees=float(hold_data["delivery_fees"]),
                currency=hold_data["currency"],
                status=hold_data["status"],
                item_settlement_completed_at=parse_datetime(hold_data["item_settlement_completed_at"])
                if hold_data.get("item_settlement_completed_at")
                else None,
                delivery_settlement_completed_at=parse_datetime(
                    hold_data["delivery_settlement_completed_at"]
                )
                if hold_data.get("delivery_settlement_completed_at")
                else None,
                created_at=parse_datetime(hold_data["created_at"]),
                updated_at=parse_datetime(hold_data["updated_at"]),
            )
            log_info("Order hold found", order_id=order_id, hold_id=order_hold.id)
            return order_hold
        
        # Create new order hold if it doesn't exist
        log_info("Order hold not found, creating new one", order_id=order_id)
        
        mutation = """
        mutation CreateOrderHold(
          $orderId: uuid!,
          $clientId: uuid!,
          $currency: currency_enum!,
          $clientHoldAmount: numeric!,
          $deliveryFees: numeric!
        ) {
          insert_order_holds_one(object: {
            order_id: $orderId,
            client_id: $clientId,
            agent_id: null,
            client_hold_amount: $clientHoldAmount,
            agent_hold_amount: 0,
            delivery_fees: $deliveryFees,
            currency: $currency,
            status: "active"
          }) {
            id
            order_id
            client_id
            agent_id
            client_hold_amount
            agent_hold_amount
            delivery_fees
            currency
            status
            created_at
            updated_at
          }
        }
        """
        
        create_data = client.execute(
            mutation,
            {
                "orderId": order_id,
                "clientId": order.client_id,
                "currency": order.currency,
                "clientHoldAmount": order.total_amount,
                "deliveryFees": 0,
            },
        )
        
        hold_data = create_data.get("insert_order_holds_one")
        if not hold_data:
            log_error("Failed to create order hold", order_id=order_id)
            return None
        
        order_hold = OrderHold(
            id=hold_data["id"],
            order_id=hold_data["order_id"],
            client_id=hold_data["client_id"],
            agent_id=hold_data.get("agent_id"),
            client_hold_amount=float(hold_data["client_hold_amount"]),
            agent_hold_amount=float(hold_data["agent_hold_amount"]),
            delivery_fees=float(hold_data["delivery_fees"]),
            currency=hold_data["currency"],
            status=hold_data["status"],
            item_settlement_completed_at=parse_datetime(hold_data["item_settlement_completed_at"])
            if hold_data.get("item_settlement_completed_at")
            else None,
            delivery_settlement_completed_at=parse_datetime(
                hold_data["delivery_settlement_completed_at"]
            )
            if hold_data.get("delivery_settlement_completed_at")
            else None,
            created_at=parse_datetime(hold_data["created_at"]),
            updated_at=parse_datetime(hold_data["updated_at"]),
        )
        log_info("Order hold created successfully", order_id=order_id, hold_id=order_hold.id)
        return order_hold
        
    except Exception as e:
        log_error("Error with order hold", error=e, order_id=order_id)
        return None


def update_order_hold_status(
    order_hold_id: str,
    status: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> bool:
    """
    Update order hold status.
    
    Args:
        order_hold_id: Order hold ID
        status: New status
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        True if successful, False otherwise
    """
    mutation = """
    mutation UpdateOrderHold($orderHoldId: uuid!, $status: order_hold_status_enum!) {
      update_order_holds_by_pk(
        pk_columns: { id: $orderHoldId }
        _set: { status: $status }
      ) {
        id
        status
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Updating order hold status", order_hold_id=order_hold_id, status=status)
    
    try:
        client.execute(mutation, {"orderHoldId": order_hold_id, "status": status})
        log_info("Order hold status updated successfully", order_hold_id=order_hold_id, status=status)
        return True
        
    except Exception as e:
        log_error("Error updating order hold", error=e, order_hold_id=order_hold_id)
        return False

