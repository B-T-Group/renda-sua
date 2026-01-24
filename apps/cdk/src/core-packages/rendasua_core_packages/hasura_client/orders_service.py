"""Order-related Hasura operations."""
from typing import Optional, Dict, Any, List
import datetime
from datetime import timezone
from rendasua_core_packages.models import Order, BusinessLocation, Address, Client, Business, Agent, OrderAgentNotification
from rendasua_core_packages.utilities.geocoding import geocode_address, persist_coordinates_to_hasura
from rendasua_core_packages.utilities import parse_datetime
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_order_with_location(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    google_maps_api_key: Optional[str] = None
) -> Optional[Order]:
    """
    Fetch order with business location and address.
    If coordinates are missing, geocode and persist them.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        google_maps_api_key: Google Maps API key for geocoding
        
    Returns:
        Order object if found, None otherwise
    """
    query = """
    query GetOrderWithLocation($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        current_status
        business_id
        business_location_id
        client_id
        delivery_address_id
        currency
        subtotal
        base_delivery_fee
        per_km_delivery_fee
        tax_amount
        total_amount
        requires_fast_delivery
        business_location {
          id
          name
          business_id
          address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            latitude
            longitude
            created_at
            updated_at
          }
          created_at
          updated_at
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching order from Hasura", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_data = data.get("orders_by_pk")
        
        if not order_data:
            log_error("Order not found in Hasura", order_id=order_id)
            return None
        
        log_info("Order fetched successfully", order_id=order_id)
        
        # Parse business location and address
        business_location_data = order_data.get("business_location")
        if not business_location_data:
            log_error("Business location not found for order", order_id=order_id)
            return None
        
        address_data = business_location_data.get("address")
        if not address_data:
            log_error("Address not found for business location", order_id=order_id)
            return None
        
        # Create address object
        address = Address(
            id=address_data["id"],
            address_line_1=address_data["address_line_1"],
            address_line_2=address_data.get("address_line_2"),
            city=address_data["city"],
            state=address_data["state"],
            postal_code=address_data.get("postal_code"),
            country=address_data["country"],
            latitude=address_data.get("latitude"),
            longitude=address_data.get("longitude"),
        )
        
        log_info(
            "Address parsed from order",
            address_id=address.id,
            has_latitude=address.latitude is not None,
            has_longitude=address.longitude is not None,
        )
        
        # If coordinates are missing, geocode and persist
        if (address.latitude is None or address.longitude is None) and google_maps_api_key:
            log_info("Coordinates missing, starting geocoding", address_id=address.id)
            coordinates = geocode_address(address, google_maps_api_key)
            
            if coordinates:
                log_info(
                    "Geocoding successful",
                    address_id=address.id,
                    latitude=coordinates.latitude,
                    longitude=coordinates.longitude,
                )
                # Update address object with new coordinates
                address.latitude = coordinates.latitude
                address.longitude = coordinates.longitude
                
                # Persist to Hasura (only if address.id is present)
                if address.id:
                    persist_coordinates_to_hasura(
                        address.id,
                        coordinates,
                        hasura_endpoint,
                        hasura_admin_secret
                    )
                else:
                    log_error("Cannot persist coordinates: address.id is None")
            else:
                log_error("Failed to geocode address", address_id=address.id)
        
        address_created_at = parse_datetime(address_data.get("created_at"))
        address_updated_at = parse_datetime(address_data.get("updated_at"))
        location_created_at = parse_datetime(business_location_data.get("created_at"))
        location_updated_at = parse_datetime(business_location_data.get("updated_at"))
        
        business_location = BusinessLocation(
            id=business_location_data["id"],
            name=business_location_data.get("name", ""),
            address=address,
            address_id=address.id,
            business_id=business_location_data.get("business_id", order_data.get("business_id", "")),
            created_at=location_created_at,
            updated_at=location_updated_at,
        )
        
        order = Order(
            id=order_data["id"],
            order_number=order_data["order_number"],
            current_status=order_data.get("current_status", ""),
            business_location=business_location,
            business_location_id=order_data.get("business_location_id", business_location.id),
            business_id=order_data.get("business_id", ""),
            client_id=order_data.get("client_id", ""),
            delivery_address_id=order_data.get("delivery_address_id", ""),
            currency=order_data.get("currency", ""),
            subtotal=float(order_data.get("subtotal", 0.0)),
            base_delivery_fee=float(order_data.get("base_delivery_fee", 0.0)),
            per_km_delivery_fee=float(order_data.get("per_km_delivery_fee", 0.0)),
            tax_amount=float(order_data.get("tax_amount", 0.0)),
            total_amount=float(order_data.get("total_amount", 0.0)),
            requires_fast_delivery=bool(order_data.get("requires_fast_delivery", False)),
        )
        
        log_info(
            "Order object created successfully",
            order_id=order.id,
            order_number=order.order_number,
            business_location=order.business_location.name if order.business_location else "N/A",
        )
        
        return order
        
    except Exception as e:
        log_error("Error fetching order", error=e, order_id=order_id)
        return None


def get_complete_order_details(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[Order]:
    """
    Fetch complete order details with all required fields for payment processing.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Order object with all required fields, None if not found
    """
    query = """
    query GetCompleteOrderDetails($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        total_amount
        currency
        client_id
        business_id
        client {
          id
          user_id
          created_at
          updated_at
        }
        business {
          id
          user_id
          name
          created_at
          updated_at
        }
        assigned_agent_id
        assigned_agent {
          id
          user_id
          created_at
          updated_at
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching complete order details", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_data = data.get("orders_by_pk")
        
        if not order_data:
            log_error("Order not found", order_id=order_id)
            return None

        client_data = order_data.get("client")
        business_data = order_data.get("business")
        assigned_agent_data = order_data.get("assigned_agent")

        # Construct Client model with required fields
        client = None
        if client_data:
            client = Client.model_construct(
                id=client_data["id"],
                user_id=client_data["user_id"],
                created_at=parse_datetime(client_data.get("created_at")),
                updated_at=parse_datetime(client_data.get("updated_at")),
            )

        # Construct Business model with required fields
        business = None
        if business_data:
            business = Business.model_construct(
                id=business_data["id"],
                user_id=business_data["user_id"],
                name=business_data.get("name", ""),
                created_at=parse_datetime(business_data.get("created_at")),
                updated_at=parse_datetime(business_data.get("updated_at")),
            )

        # Construct Agent model with required fields
        assigned_agent = None
        if assigned_agent_data:
            assigned_agent = Agent.model_construct(
                id=assigned_agent_data["id"],
                user_id=assigned_agent_data["user_id"],
                created_at=parse_datetime(assigned_agent_data.get("created_at")),
                updated_at=parse_datetime(assigned_agent_data.get("updated_at")),
            )
        
        # Create a minimal Order object with required fields
        # Note: This function returns a simplified Order for payment processing
        order = Order(
            id=order_data["id"],
            order_number=order_data["order_number"],
            total_amount=float(order_data["total_amount"]),
            currency=order_data["currency"],
            client_id=order_data["client_id"],
            business_id=order_data.get("business_id", ""),
            assigned_agent_id=order_data.get("assigned_agent_id"),
            assigned_agent=assigned_agent,
            client=client,
            business=business,
            current_status="",  # Not fetched in this query
            business_location_id="",  # Not fetched in this query
            delivery_address_id="",  # Not fetched in this query
            subtotal=0.0,
            base_delivery_fee=0.0,
            per_km_delivery_fee=0.0,
            tax_amount=0.0,
            requires_fast_delivery=False,
        )
        
        log_info("Complete order details fetched successfully", order_id=order_id)
        return order
        
    except Exception as e:
        log_error("Error fetching complete order details", error=e, order_id=order_id)
        return None


def get_order_details_for_notification(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[Dict[str, Any]]:
    """
    Get order details with all fields needed for notifications.
    
    Args:
        order_id: Order ID
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Dictionary with order details for notifications, None if not found
    """
    query = """
    query GetOrderForNotification($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        current_status
        subtotal
        base_delivery_fee
        per_km_delivery_fee
        tax_amount
        total_amount
        currency
        estimated_delivery_time
        special_instructions
        client {
          user {
            first_name
            last_name
            email
          }
        }
        business {
          name
          is_verified
          user {
            email
          }
        }
        assigned_agent {
          user {
            first_name
            last_name
            email
          }
        }
        delivery_address {
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
        }
        order_items {
          item_name
          quantity
          unit_price
          total_price
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching order details for notification", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_data = data.get("orders_by_pk")
        
        if not order_data:
            log_error("Order not found", order_id=order_id)
            return None
        
        # Format delivery address
        delivery_address_data = order_data.get("delivery_address", {})
        delivery_address_parts = [
            delivery_address_data.get("address_line_1", ""),
            delivery_address_data.get("address_line_2", ""),
            delivery_address_data.get("city", ""),
            delivery_address_data.get("state", ""),
            delivery_address_data.get("postal_code", ""),
            delivery_address_data.get("country", ""),
        ]
        delivery_address = ", ".join(part for part in delivery_address_parts if part)
        
        # Format client name
        client_data = order_data.get("client", {}).get("user", {})
        client_name = f"{client_data.get('first_name', '')} {client_data.get('last_name', '')}".strip()
        
        # Format agent name (if exists)
        agent_name = None
        agent_email = None
        assigned_agent_data = order_data.get("assigned_agent")
        if assigned_agent_data:
            agent_user = assigned_agent_data.get("user", {})
            agent_name = f"{agent_user.get('first_name', '')} {agent_user.get('last_name', '')}".strip()
            agent_email = agent_user.get("email")
        
        # Format order items
        order_items = []
        for item in order_data.get("order_items", []):
            order_items.append({
                "name": item.get("item_name", "Unknown Item"),
                "quantity": item.get("quantity", 0),
                "unitPrice": float(item.get("unit_price", 0)),
                "totalPrice": float(item.get("total_price", 0)),
            })
        
        notification_data = {
            "orderId": order_data["id"],
            "orderNumber": order_data.get("order_number", "Unknown"),
            "clientName": client_name,
            "clientEmail": client_data.get("email"),
            "businessName": order_data.get("business", {}).get("name", "Unknown Business"),
            "businessEmail": order_data.get("business", {}).get("user", {}).get("email"),
            "businessVerified": order_data.get("business", {}).get("is_verified", False),
            "agentName": agent_name,
            "agentEmail": agent_email,
            "orderStatus": order_data.get("current_status", "Unknown"),
            "orderItems": order_items,
            "subtotal": float(order_data.get("subtotal", 0)),
            "deliveryFee": float(order_data.get("base_delivery_fee", 0)),
            "fastDeliveryFee": float(order_data.get("per_km_delivery_fee", 0)),
            "taxAmount": float(order_data.get("tax_amount", 0)),
            "totalAmount": float(order_data.get("total_amount", 0)),
            "currency": order_data.get("currency", "USD"),
            "deliveryAddress": delivery_address,
            "estimatedDeliveryTime": order_data.get("estimated_delivery_time"),
            "specialInstructions": order_data.get("special_instructions"),
        }
        
        log_info("Order details for notification fetched successfully", order_id=order_id)
        return notification_data
        
    except Exception as e:
        log_error("Error fetching order details for notification", error=e, order_id=order_id)
        return None


def get_order_items_for_reserved_restore(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[Dict[str, Any]]:
    """
    Fetch order items with business_inventory_id and quantity for reserved-quantity restore.

    Returns:
        List of {"business_inventory_id": str, "quantity": int}. Empty if order not found.
    """
    query = """
    query GetOrderItemsForRestore($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        order_items {
          business_inventory_id
          quantity
        }
      }
    }
    """
    client = HasuraClient(
        HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret)
    )
    try:
        data = client.execute(query, {"orderId": order_id})
        order = data.get("orders_by_pk")
        if not order:
            log_error("Order not found for reserved restore", order_id=order_id)
            return []
        items = order.get("order_items", [])
        result = [
            {"business_inventory_id": i["business_inventory_id"], "quantity": i["quantity"]}
            for i in items
            if i.get("business_inventory_id") and i.get("quantity") is not None
        ]
        log_info(
            "Fetched order items for reserved restore",
            order_id=order_id,
            item_count=len(result),
        )
        return result
    except Exception as e:
        log_error(
            "Error fetching order items for reserved restore",
            error=e,
            order_id=order_id,
        )
        raise


def cancel_order(
    order_id: str,
    notes: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> Dict[str, Any]:
    """
    Cancel an order (e.g. payment timeout): update status, insert history, restore reserved quantities.
    Does not send SQS; caller handles that if needed.

    Args:
        order_id: Order ID to cancel
        notes: Notes for status history (e.g. "Order cancelled due to payment timeout")
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret

    Returns:
        {"success": True} on success, {"success": False, "error": str} on failure.
    """
    client = HasuraClient(
        HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret)
    )
    try:
        # 1. Update order to cancelled
        update_mutation = """
        mutation UpdateOrderCancelled($orderId: uuid!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { current_status: "cancelled", payment_status: "cancelled" }
          ) {
            id
            current_status
          }
        }
        """
        data = client.execute(update_mutation, {"orderId": order_id})
        if not data.get("update_orders_by_pk"):
            log_error("Update order to cancelled returned no row", order_id=order_id)
            return {"success": False, "error": "Failed to update order to cancelled"}

        log_info("Updated order to cancelled", order_id=order_id)

        # 2. Insert status history (changed_by_type 'system')
        history_mutation = """
        mutation InsertStatusHistorySystem($orderId: uuid!, $notes: String!, $changedByType: String!) {
          insert_order_status_history_one(
            object: {
              order_id: $orderId
              status: cancelled
              notes: $notes
              changed_by_type: $changedByType
            }
          ) {
            id
          }
        }
        """
        client.execute(
            history_mutation,
            {"orderId": order_id, "notes": notes, "changedByType": "system"},
        )
        log_info("Inserted status history (system)", order_id=order_id)

        # 3. Restore reserved quantities
        items = get_order_items_for_reserved_restore(
            order_id, hasura_endpoint, hasura_admin_secret
        )
        if not items:
            log_info("No order items to restore", order_id=order_id)
            return {"success": True}

        ids = [it["business_inventory_id"] for it in items]
        fetch_query = """
        query GetReservedQuantities($ids: [uuid!]!) {
          business_inventory(where: { id: { _in: $ids } }) {
            id
            reserved_quantity
          }
        }
        """
        fetch_data = client.execute(fetch_query, {"ids": ids})
        rows = {r["id"]: r for r in fetch_data.get("business_inventory", [])}

        for it in items:
            bi_id = it["business_inventory_id"]
            qty = it["quantity"]
            curr = rows.get(bi_id, {}).get("reserved_quantity", 0)
            new_val = max(0, curr - qty)
            update_mut = """
            mutation UpdateReserved($id: uuid!, $reserved: Int!) {
              update_business_inventory_by_pk(
                pk_columns: { id: $id }
                _set: { reserved_quantity: $reserved }
              ) {
                id
                reserved_quantity
              }
            }
            """
            client.execute(update_mut, {"id": bi_id, "reserved": new_val})
            log_info(
                "Decremented reserved quantity",
                order_id=order_id,
                business_inventory_id=bi_id,
                quantity=qty,
                previous=curr,
                new=new_val,
            )

        return {"success": True}
    except Exception as e:
        log_error("cancel_order failed", error=e, order_id=order_id)
        return {"success": False, "error": str(e)}


def get_order_business_location_country(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[str]:
    """
    Get the country code from the order's business location address.
    
    Args:
        order_id: Order ID
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Country code if found, None otherwise
    """
    query = """
    query GetOrderBusinessLocationCountry($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        business_location {
          address {
            country
          }
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching order business location country", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_data = data.get("orders_by_pk")
        
        if not order_data:
            log_error("Order not found", order_id=order_id)
            return None
        
        business_location = order_data.get("business_location")
        if not business_location:
            log_error("Business location not found", order_id=order_id)
            return None
        
        address = business_location.get("address")
        if not address:
            log_error("Address not found", order_id=order_id)
            return None
        
        country = address.get("country")
        log_info("Order business location country found", order_id=order_id, country=country)
        return country
        
    except Exception as e:
        log_error("Error fetching order business location country", error=e, order_id=order_id)
        return None


def create_pending_agent_notification(
    order_id: str,
    notification_type: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[str]:
    """
    Create a pending agent notification record.
    
    Args:
        order_id: Order ID
        notification_type: Type of notification (e.g., 'order_proximity')
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Notification ID if created successfully, None otherwise
    """
    mutation = """
    mutation CreatePendingAgentNotification($orderId: uuid!, $notificationType: notification_type!) {
      insert_order_agent_notifications_one(
        object: {
          order_id: $orderId
          notification_type: $notificationType
          status: pending
        }
        on_conflict: {
          constraint: order_agent_notifications_order_type_unique
          update_columns: []
        }
      ) {
        id
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Creating pending agent notification", order_id=order_id, notification_type=notification_type)
    
    try:
        data = client.execute(mutation, {
            "orderId": order_id,
            "notificationType": notification_type
        })
        notification_data = data.get("insert_order_agent_notifications_one")
        
        if not notification_data:
            log_info("Notification record already exists or was not created", order_id=order_id)
            return None
        
        notification_id = notification_data.get("id")
        log_info("Pending agent notification created", order_id=order_id, notification_id=notification_id)
        return notification_id
        
    except Exception as e:
        log_error("Error creating pending agent notification", error=e, order_id=order_id)
        return None


def get_pending_agent_notifications(
    notification_type: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[OrderAgentNotification]:
    """
    Fetch all pending agent notifications of a specific type.
    
    Args:
        notification_type: Type of notification to fetch (e.g., 'order_proximity')
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        List of OrderAgentNotification objects with order details
    """
    query = """
    query GetPendingAgentNotifications($notificationType: notification_type!) {
      order_agent_notifications(
        where: {
          status: { _eq: pending }
          notification_type: { _eq: $notificationType }
        }
      ) {
        id
        order_id
        notification_type
        status
        error_message
        created_at
        updated_at
        processed_at
        order {
          id
          order_number
          current_status
          business_location {
            id
            name
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              latitude
              longitude
            }
          }
        }
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching pending agent notifications", notification_type=notification_type)
    
    try:
        data = client.execute(query, {"notificationType": notification_type})
        notifications_data = data.get("order_agent_notifications", [])
        log_info("Fetched pending notifications", count=len(notifications_data), notification_type=notification_type)
        
        # Convert dicts to OrderAgentNotification objects
        notifications = []
        for notification_data in notifications_data:
            try:
                # Parse order data if present
                order_data = notification_data.get("order")
                order = None
                if order_data:
                    # Create a minimal Order object with available fields
                    # Use model_construct to allow partial data
                    business_location_data = order_data.get("business_location")
                    business_location = None
                    if business_location_data:
                        address_data = business_location_data.get("address")
                        address = None
                        if address_data:
                            address = Address.model_construct(
                                id=address_data.get("id", ""),
                                address_line_1=address_data.get("address_line_1", ""),
                                address_line_2=address_data.get("address_line_2"),
                                city=address_data.get("city", ""),
                                state=address_data.get("state", ""),
                                postal_code=address_data.get("postal_code", ""),
                                country=address_data.get("country", ""),
                                latitude=address_data.get("latitude"),
                                longitude=address_data.get("longitude"),
                            )
                        business_location = BusinessLocation.model_construct(
                            id=business_location_data.get("id", ""),
                            name=business_location_data.get("name", ""),
                            address=address,
                        )
                    
                    order = Order.model_construct(
                        id=order_data.get("id", ""),
                        order_number=order_data.get("order_number", ""),
                        current_status=order_data.get("current_status", ""),
                        business_location=business_location,
                        
                    )
                
                # Create OrderAgentNotification object
                notification = OrderAgentNotification.model_construct(
                    id=notification_data.get("id", ""),
                    order_id=notification_data.get("order_id", ""),
                    notification_type=notification_data.get("notification_type", ""),
                    status=notification_data.get("status", ""),
                    error_message=notification_data.get("error_message"),
                    created_at=parse_datetime(notification_data.get("created_at")),
                    updated_at=parse_datetime(notification_data.get("updated_at")),
                    processed_at=parse_datetime(notification_data.get("processed_at")),
                    order=order,
                )
                notifications.append(notification)
            except Exception as e:
                log_error(
                    "Error parsing notification data",
                    error=e,
                    notification_id=notification_data.get("id"),
                )
                # Continue processing other notifications
                continue
        
        log_info("Parsed notifications into objects", count=len(notifications), notification_type=notification_type)
        return notifications
        
    except Exception as e:
        log_error("Error fetching pending agent notifications", error=e, notification_type=notification_type)
        return []


def update_notification_status(
    notification_id: str,
    status: str,
    error_message: Optional[str],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> bool:
    """
    Update the status of an agent notification.
    
    Args:
        notification_id: Notification ID
        status: New status ('complete', 'failed', 'skipped')
        error_message: Optional error message
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        True if successful, False otherwise
    """
    mutation = """
    mutation UpdateNotificationStatus(
      $id: uuid!
      $status: notification_status!
      $errorMessage: String
      $processedAt: timestamptz
    ) {
      update_order_agent_notifications_by_pk(
        pk_columns: { id: $id }
        _set: {
          status: $status
          error_message: $errorMessage
          processed_at: $processedAt
        }
      ) {
        id
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Updating notification status", notification_id=notification_id, status=status)
    
    try:
        # Get current timestamp in ISO format
        processed_at = datetime.datetime.now(timezone.utc).isoformat()
        variables = {
            "id": notification_id,
            "status": status,
            "errorMessage": error_message,
            "processedAt": processed_at
        }
        data = client.execute(mutation, variables)
        updated = data.get("update_order_agent_notifications_by_pk")
        
        if not updated:
            log_error("Notification not found for update", notification_id=notification_id)
            return False
        
        log_info("Notification status updated", notification_id=notification_id, status=status)
        return True
        
    except Exception as e:
        log_error("Error updating notification status", error=e, notification_id=notification_id)
        return False

