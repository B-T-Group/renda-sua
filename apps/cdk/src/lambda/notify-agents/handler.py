"""Lambda handler for processing pending agent notifications."""
import json
import os
from typing import Dict, Any, List, Optional
from rendasua_core_packages.hasura_client import (
    get_order_with_location,
    get_all_agent_locations,
)
from rendasua_core_packages.hasura_client.orders_service import (
    get_pending_agent_notifications,
    update_notification_status,
)
from rendasua_core_packages.utilities import calculate_haversine_distance, format_distance
from rendasua_core_packages.secrets_manager import get_hasura_admin_secret, get_google_maps_api_key
from notifications import send_aggregated_notifications_to_agents, send_notifications_to_nearby_agents
from rendasua_core_packages.models import Order, OrderAgentNotification


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] {message}" + (f" | {context_str}" if context_str else "") + error_str)


def process_all_notifications_aggregated(
    pending_notifications: List[OrderAgentNotification],
    hasura_endpoint: str,
    hasura_admin_secret: str,
    environment: str,
    proximity_radius_km: float,
    template_id: str,
    google_maps_api_key: Optional[str]
) -> Dict[str, Any]:
    """
    Process all pending notifications by aggregating orders per agent.
    
    Args:
        pending_notifications: List of pending OrderAgentNotification objects
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        environment: Environment name
        proximity_radius_km: Proximity radius in kilometers
        template_id: SendGrid template ID
        google_maps_api_key: Google Maps API key
        
    Returns:
        Result dictionary with processing status
    """
    log_info(
        "Starting aggregated notification processing",
        total_notifications=len(pending_notifications),
        proximity_radius_km=proximity_radius_km,
    )
    
    # Step 1: Extract unique orders from notifications
    # Deduplicate by order_id and filter for ready_for_pickup status
    unique_orders: Dict[str, Order] = {}
    notification_ids_by_order: Dict[str, List[str]] = {}
    
    for notification in pending_notifications:
        order_from_notification = notification.order
        if not order_from_notification:
            continue
            
        current_status = order_from_notification.current_status
        order_id = notification.order_id
        
        # Skip if order status changed
        if current_status and current_status != "ready_for_pickup":
            log_info(
                "Order status changed, skipping",
                order_id=order_id,
                current_status=current_status,
            )
            update_notification_status(
                notification_id=notification.id,
                status="skipped",
                error_message=f"Order status changed to {current_status}",
                hasura_endpoint=hasura_endpoint,
                hasura_admin_secret=hasura_admin_secret
            )
            continue
        
        # Track notification IDs for this order
        if order_id not in notification_ids_by_order:
            notification_ids_by_order[order_id] = []
        notification_ids_by_order[order_id].append(notification.id)
        
        # Add order if not already added (deduplication)
        if order_id not in unique_orders:
            unique_orders[order_id] = order_from_notification
    
    log_info(
        "Extracted unique orders",
        unique_orders_count=len(unique_orders),
        total_notifications=len(pending_notifications),
    )
    
    if not unique_orders:
        log_info("No valid orders to process")
        return {
            "success": True,
            "status": "complete",
            "message": "No valid orders to process",
            "notifications_sent": 0,
        }
    
    # Step 2: Fetch complete order data with locations for orders missing coordinates
    valid_orders: List[Order] = []
    for order_id, order in unique_orders.items():
        # Check if order has complete location data
        if not order.business_location or not order.business_location.address or \
           order.business_location.address.latitude is None or \
           order.business_location.address.longitude is None:
            log_info("Fetching order with location", order_id=order_id)
            fetched_order = get_order_with_location(
                order_id=order_id,
                hasura_endpoint=hasura_endpoint,
                hasura_admin_secret=hasura_admin_secret,
                google_maps_api_key=google_maps_api_key
            )
            if fetched_order:
                valid_orders.append(fetched_order)
            else:
                log_error("Order not found or missing location", order_id=order_id)
                # Mark related notifications as failed
                for notif_id in notification_ids_by_order.get(order_id, []):
                    update_notification_status(
                        notification_id=notif_id,
                        status="failed",
                        error_message="Order not found or missing location",
                        hasura_endpoint=hasura_endpoint,
                        hasura_admin_secret=hasura_admin_secret
                    )
        else:
            valid_orders.append(order)
    
    if not valid_orders:
        log_error("No orders with valid locations")
        return {
            "success": False,
            "status": "failed",
            "message": "No orders with valid locations",
            "notifications_sent": 0,
        }
    
    log_info(
        "Valid orders with locations",
        valid_orders_count=len(valid_orders),
    )
    
    # Step 3: Fetch all agent locations
    log_info("Fetching all agent locations")
    agent_locations = get_all_agent_locations(
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not agent_locations:
        log_info("No agent locations found")
        # Mark all notifications as complete (no agents available)
        for order_id, notif_ids in notification_ids_by_order.items():
            for notif_id in notif_ids:
                update_notification_status(
                    notification_id=notif_id,
                    status="complete",
                    error_message="No agents available",
                    hasura_endpoint=hasura_endpoint,
                    hasura_admin_secret=hasura_admin_secret
                )
        return {
            "success": True,
            "status": "complete",
            "message": "No agents available",
            "notifications_sent": 0,
        }
    
    # Step 4: For each agent, find all nearby orders
    # Structure: agent_id -> list of order_ids
    agent_nearby_orders: Dict[str, List[str]] = {}
    
    log_info(
        "Calculating distances for all agent-order pairs",
        total_agents=len(agent_locations),
        total_orders=len(valid_orders),
    )
    
    for agent_location in agent_locations:
        agent_id = agent_location.agent_id
        nearby_order_ids = []
        
        for order in valid_orders:
            order_address = order.business_location.address
            if not order_address or order_address.latitude is None or order_address.longitude is None:
                continue
            
            distance = calculate_haversine_distance(
                order_address.latitude,
                order_address.longitude,
                agent_location.latitude,
                agent_location.longitude
            )
            
            if distance <= proximity_radius_km:
                nearby_order_ids.append(order.id)
        
        if nearby_order_ids:
            agent_nearby_orders[agent_id] = nearby_order_ids
    
    log_info(
        "Distance calculation complete",
        agents_with_nearby_orders=len(agent_nearby_orders),
        total_agents_checked=len(agent_locations),
    )
    
    if not agent_nearby_orders:
        log_info(
            "No agents within proximity radius for any orders",
            proximity_radius_km=proximity_radius_km,
        )
        # Mark all notifications as complete
        for order_id, notif_ids in notification_ids_by_order.items():
            for notif_id in notif_ids:
                update_notification_status(
                    notification_id=notif_id,
                    status="complete",
                    error_message=f"No agents within {proximity_radius_km}km",
                    hasura_endpoint=hasura_endpoint,
                    hasura_admin_secret=hasura_admin_secret
                )
        return {
            "success": True,
            "status": "complete",
            "message": f"No agents within {proximity_radius_km}km",
            "notifications_sent": 0,
        }
    
    # Step 5: Send aggregated notifications (one per agent)
    log_info(
        "Sending aggregated notifications to agents",
        agents_to_notify=len(agent_nearby_orders),
    )
    
    try:
        # Create mapping of agent_id to order_count
        agent_order_counts: Dict[str, int] = {
            agent_id: len(order_ids) 
            for agent_id, order_ids in agent_nearby_orders.items()
        }
        
        # Get agent locations for agents that need notifications
        agents_to_notify = [
            loc for loc in agent_locations 
            if loc.agent_id in agent_nearby_orders
        ]
        
        notifications_sent = send_aggregated_notifications_to_agents(
            agents_to_notify,
            agent_order_counts,
            proximity_radius_km,
            environment,
            template_id
        )
        
        log_info(
            "Aggregated notifications sent successfully",
            notifications_sent=notifications_sent,
            agents_notified=len(agents_to_notify),
        )
        
        # Step 6: Mark all related notifications as complete
        # For each order that was included in any agent's notification, mark its notifications as complete
        notified_order_ids = set()
        for order_ids in agent_nearby_orders.values():
            notified_order_ids.update(order_ids)
        
        for order_id in notified_order_ids:
            for notif_id in notification_ids_by_order.get(order_id, []):
                update_notification_status(
                    notification_id=notif_id,
                    status="complete",
                    error_message=None,
                    hasura_endpoint=hasura_endpoint,
                    hasura_admin_secret=hasura_admin_secret
                )
        
        return {
            "success": True,
            "status": "complete",
            "message": "Aggregated notifications sent successfully",
            "notifications_sent": notifications_sent,
            "agents_notified": len(agents_to_notify),
            "orders_included": len(notified_order_ids),
        }
        
    except Exception as e:
        log_error(
            "Error sending aggregated notifications",
            error=e,
        )
        # Mark all notifications as failed
        for order_id, notif_ids in notification_ids_by_order.items():
            for notif_id in notif_ids:
                update_notification_status(
                    notification_id=notif_id,
                    status="failed",
                    error_message=str(e),
                    hasura_endpoint=hasura_endpoint,
                    hasura_admin_secret=hasura_admin_secret
                )
        return {
            "success": False,
            "status": "failed",
            "message": f"Error sending aggregated notifications: {str(e)}",
        }


def process_notification(
    notification,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    environment: str,
    proximity_radius_km: float,
    template_id: str,
    google_maps_api_key: Optional[str]
) -> Dict[str, Any]:
    """
    Process a single pending notification.
    
    Args:
        notification: OrderAgentNotification object
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        environment: Environment name
        proximity_radius_km: Proximity radius in kilometers
        template_id: SendGrid template ID
        google_maps_api_key: Google Maps API key
        
    Returns:
        Result dictionary with processing status
    """
    notification_id = notification.id
    order_id = notification.order_id
    notification_type = notification.notification_type
    order_from_notification = notification.order
    current_status = order_from_notification.current_status if order_from_notification else None
    
    log_info(
        "Processing notification",
        notification_id=notification_id,
        order_id=order_id,
        notification_type=notification_type,
        current_status=current_status,
    )
    
    # Check if order is still in ready_for_pickup status (if we have status from notification)
    if current_status and current_status != "ready_for_pickup":
        log_info(
            "Order status changed, skipping notification",
            order_id=order_id,
            current_status=current_status,
            expected_status="ready_for_pickup",
        )
        update_notification_status(
            notification_id=notification_id,
            status="skipped",
            error_message=f"Order status changed to {current_status}",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": True,
            "status": "skipped",
            "message": f"Order status changed to {current_status}",
        }
    
    # Use order from notification if it has complete location data, otherwise fetch it
    order = order_from_notification
    if not order or not order.business_location or not order.business_location.address or \
       order.business_location.address.latitude is None or order.business_location.address.longitude is None:
        log_info("Fetching order with location", order_id=order_id)
        order = get_order_with_location(
            order_id=order_id,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
            google_maps_api_key=google_maps_api_key
        )
    
    if not order:
        log_error("Order not found", order_id=order_id)
        update_notification_status(
            notification_id=notification_id,
            status="failed",
            error_message="Order not found",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": False,
            "status": "failed",
            "message": "Order not found",
        }
    
    # Check if business location has coordinates
    address = order.business_location.address
    if address.latitude is None or address.longitude is None:
        log_error(
            "Business location coordinates not available",
            order_id=order_id,
        )
        update_notification_status(
            notification_id=notification_id,
            status="failed",
            error_message="Business location coordinates not available",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": False,
            "status": "failed",
            "message": "Business location coordinates not available",
        }
    
    # Fetch all agent locations
    log_info("Fetching all agent locations", order_id=order_id)
    agent_locations = get_all_agent_locations(
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not agent_locations:
        log_info("No agent locations found", order_id=order_id)
        update_notification_status(
            notification_id=notification_id,
            status="complete",
            error_message="No agents available",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": True,
            "status": "complete",
            "message": "No agents available",
            "notifications_sent": 0,
        }
    
    # Calculate distances and filter nearby agents
    log_info(
        "Calculating distances to agents",
        order_id=order_id,
        total_agents=len(agent_locations),
        proximity_radius_km=proximity_radius_km,
    )
    
    nearby_agents = []
    distances = []
    
    for agent_location in agent_locations:
        distance = calculate_haversine_distance(
            address.latitude,
            address.longitude,
            agent_location.latitude,
            agent_location.longitude
        )
        
        if distance <= proximity_radius_km:
            nearby_agents.append(agent_location)
            distances.append(distance)
    
    log_info(
        "Distance calculation complete",
        order_id=order_id,
        nearby_agents_count=len(nearby_agents),
        total_agents_checked=len(agent_locations),
    )
    
    if not nearby_agents:
        log_info(
            "No agents within proximity radius",
            order_id=order_id,
            proximity_radius_km=proximity_radius_km,
        )
        update_notification_status(
            notification_id=notification_id,
            status="complete",
            error_message=f"No agents within {proximity_radius_km}km",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": True,
            "status": "complete",
            "message": f"No agents within {proximity_radius_km}km",
            "notifications_sent": 0,
        }
    
    # Send notifications to nearby agents
    log_info(
        "Sending notifications to nearby agents",
        order_id=order_id,
        nearby_agents_count=len(nearby_agents),
    )
    
    try:
        notifications_sent = send_notifications_to_nearby_agents(
            nearby_agents,
            order,
            distances,
            environment,
            template_id
        )
        
        log_info(
            "Notifications sent successfully",
            order_id=order_id,
            notifications_sent=notifications_sent,
            nearby_agents_count=len(nearby_agents),
        )
        
        # Update notification status to complete
        update_notification_status(
            notification_id=notification_id,
            status="complete",
            error_message=None,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        
        return {
            "success": True,
            "status": "complete",
            "message": "Notifications sent successfully",
            "notifications_sent": notifications_sent,
            "nearby_agents_count": len(nearby_agents),
        }
        
    except Exception as e:
        log_error(
            "Error sending notifications",
            error=e,
            order_id=order_id,
        )
        update_notification_status(
            notification_id=notification_id,
            status="failed",
            error_message=str(e),
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        return {
            "success": False,
            "status": "failed",
            "message": f"Error sending notifications: {str(e)}",
        }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler entry point.
    
    Processes all pending agent notifications of type 'order_proximity'.
    """
    log_info(
        "Notify agents Lambda handler invoked",
        request_id=context.aws_request_id if context else "unknown",
        function_name=context.function_name if context else "unknown",
    )
    
    try:
        # Get configuration
        environment = os.environ.get("ENVIRONMENT", "development")
        hasura_endpoint = os.environ.get("GRAPHQL_ENDPOINT")
        proximity_radius_km = float(os.environ.get("PROXIMITY_RADIUS_KM", "20"))
        template_id = os.environ.get("SENDGRID_ORDER_PROXIMITY_TEMPLATE_ID", "")
        
        log_info(
            "Loaded configuration",
            environment=environment,
            hasura_endpoint=hasura_endpoint,
            proximity_radius_km=proximity_radius_km,
            template_id=template_id[:10] + "..." if template_id else "not_set",
        )
        
        if not hasura_endpoint:
            log_error("GRAPHQL_ENDPOINT not configured")
            return {
                "success": False,
                "error": "GRAPHQL_ENDPOINT not configured",
            }
        
        # Get secrets
        log_info("Retrieving secrets from AWS Secrets Manager", environment=environment)
        try:
            hasura_admin_secret = get_hasura_admin_secret(environment)
        except ValueError as e:
            log_error("Failed to retrieve Hasura admin secret", error=e)
            return {
                "success": False,
                "error": "Failed to retrieve Hasura admin secret",
            }
        google_maps_api_key = get_google_maps_api_key(environment)
        
        log_info("Successfully retrieved secrets")
        
        # Fetch all pending notifications
        log_info("Fetching pending agent notifications", notification_type="order_proximity")
        pending_notifications = get_pending_agent_notifications(
            notification_type="order_proximity",
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret
        )
        
        log_info(
            "Fetched pending notifications",
            count=len(pending_notifications),
        )
        
        if not pending_notifications:
            log_info("No pending notifications to process")
            return {
                "success": True,
                "message": "No pending notifications to process",
                "processed_count": 0,
            }
        
        # Process all notifications in aggregated mode
        result = process_all_notifications_aggregated(
            pending_notifications=pending_notifications,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
            environment=environment,
            proximity_radius_km=proximity_radius_km,
            template_id=template_id,
            google_maps_api_key=google_maps_api_key
        )
        
        log_info(
            "Processing complete",
            status=result.get("status"),
            notifications_sent=result.get("notifications_sent", 0),
            agents_notified=result.get("agents_notified", 0),
            orders_included=result.get("orders_included", 0),
        )
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", "Processing complete"),
            "processed_count": len(pending_notifications),
            "notifications_sent": result.get("notifications_sent", 0),
            "agents_notified": result.get("agents_notified", 0),
            "orders_included": result.get("orders_included", 0),
            "status": result.get("status"),
        }
        
    except Exception as e:
        log_error("Unhandled error in Lambda handler", error=e)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }

