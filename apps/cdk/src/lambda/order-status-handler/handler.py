"""Main Lambda handler for order status notifications."""
import json
import os
from typing import Dict, Any, Optional
from models import Order, AgentLocation, SQSEventMessage
from hasura_client import (
    get_order_with_location,
    get_all_agent_locations,
    get_complete_order_details,
    get_or_create_order_hold,
    get_account_by_user_and_currency,
    register_account_transaction,
    update_order_hold_status,
)
from distance import calculate_haversine_distance, format_distance
from notifications import send_notifications_to_nearby_agents
from secrets_manager import get_hasura_admin_secret, get_google_maps_api_key


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] {message}" + (f" | {context_str}" if context_str else "") + error_str)


def extract_order_id_from_sqs_record(record: Dict[str, Any]) -> Optional[str]:
    """Extract order ID from SQS record."""
    try:
        body = json.loads(record.get("body", "{}"))
        order_id = body.get("orderId")
        log_info("Extracted order ID from SQS record", order_id=order_id)
        return order_id
    except Exception as e:
        log_error("Error extracting order ID from SQS record", error=e)
        return None


def parse_sqs_event_message(record: Dict[str, Any]) -> Optional[SQSEventMessage]:
    """Parse SQS event message from record."""
    try:
        body = json.loads(record.get("body", "{}"))
        message = SQSEventMessage(
            eventType=body.get("eventType"),
            orderId=body.get("orderId"),
            timestamp=body.get("timestamp"),
            status=body.get("status"),
        )
        log_info(
            "Parsed SQS event message",
            event_type=message.eventType,
            order_id=message.orderId,
            status=message.status,
        )
        return message
    except Exception as e:
        log_error("Error parsing SQS event message", error=e, body=record.get("body", ""))
        return None


def process_order_event(
    order_id: str,
    event_type: str,
    environment: str
) -> Dict[str, Any]:
    """
    Process order event and notify nearby agents.
    
    Args:
        order_id: Order ID to process
        event_type: Type of event (order.created, order.completed, order.status.updated)
        environment: Environment name (development or production)
        
    Returns:
        Result dictionary with success status and details
    """
    try:
        log_info(
            "Starting order event processing",
            order_id=order_id,
            event_type=event_type,
            environment=environment,
        )
        
        # Get configuration
        hasura_endpoint = os.environ.get("GRAPHQL_ENDPOINT")
        proximity_radius_km = float(os.environ.get("PROXIMITY_RADIUS_KM", "10"))
        template_id = os.environ.get("SENDGRID_ORDER_PROXIMITY_TEMPLATE_ID", "")
        
        log_info(
            "Loaded configuration",
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
        hasura_admin_secret = get_hasura_admin_secret(environment)
        google_maps_api_key = get_google_maps_api_key(environment)
        
        if not hasura_admin_secret:
            log_error("Failed to retrieve Hasura admin secret")
            return {
                "success": False,
                "error": "Failed to retrieve Hasura admin secret",
            }
        
        log_info("Successfully retrieved secrets")
        
        # Fetch order with location
        log_info("Fetching order with location data", order_id=order_id)
        order = get_order_with_location(
            order_id,
            hasura_endpoint,
            hasura_admin_secret,
            google_maps_api_key
        )
        
        if not order:
            log_error("Order not found", order_id=order_id)
            return {
                "success": False,
                "error": f"Order {order_id} not found",
            }
        
        log_info(
            "Order fetched successfully",
            order_id=order.id,
            order_number=order.order_number,
            business_location=order.business_location.name,
        )
        
        # Check if business location has coordinates
        address = order.business_location.address
        log_info(
            "Checking business location coordinates",
            order_id=order_id,
            latitude=address.latitude,
            longitude=address.longitude,
        )
        
        if address.latitude is None or address.longitude is None:
            log_error(
                "Business location coordinates not available",
                order_id=order_id,
                address=address.format_full_address(),
            )
            return {
                "success": False,
                "error": f"Business location coordinates not available for order {order_id}",
            }
        
        # Fetch all agent locations
        log_info("Fetching all agent locations")
        agent_locations = get_all_agent_locations(
            hasura_endpoint,
            hasura_admin_secret
        )
        
        log_info("Agent locations fetched", count=len(agent_locations) if agent_locations else 0)
        
        if not agent_locations:
            log_info("No agent locations found - no notifications to send")
            return {
                "success": True,
                "message": "No agents available",
                "notifications_sent": 0,
            }
        
        # Calculate distances and filter nearby agents
        log_info(
            "Calculating distances to agents",
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
            
            log_info(
                "Calculated distance to agent",
                agent_id=agent_location.agent_id,
                distance_km=round(distance, 2),
                within_radius=distance <= proximity_radius_km,
            )
            
            if distance <= proximity_radius_km:
                nearby_agents.append(agent_location)
                distances.append(distance)
                log_info(
                    "Agent within proximity radius",
                    agent_id=agent_location.agent_id,
                    distance=format_distance(distance),
                )
        
        log_info(
            "Distance calculation complete",
            nearby_agents_count=len(nearby_agents),
            total_agents_checked=len(agent_locations),
        )
        
        if not nearby_agents:
            log_info(
                "No agents within proximity radius",
                proximity_radius_km=proximity_radius_km,
                order_id=order_id,
            )
            return {
                "success": True,
                "message": f"No agents within {proximity_radius_km}km",
                "notifications_sent": 0,
            }
        
        # Send notifications to nearby agents
        log_info(
            "Sending notifications to nearby agents",
            nearby_agents_count=len(nearby_agents),
            order_id=order_id,
            template_id=template_id[:10] + "..." if template_id else "not_set",
        )
        
        notifications_sent = send_notifications_to_nearby_agents(
            nearby_agents,
            order,
            distances,
            environment,
            template_id
        )
        
        log_info(
            "Order event processing completed successfully",
            order_id=order_id,
            event_type=event_type,
            nearby_agents_count=len(nearby_agents),
            notifications_sent=notifications_sent,
        )
        
        return {
            "success": True,
            "message": f"Processed {event_type} event",
            "order_id": order_id,
            "nearby_agents_count": len(nearby_agents),
            "notifications_sent": notifications_sent,
        }
        
    except Exception as e:
        log_error(
            "Error processing order event",
            error=e,
            order_id=order_id,
            event_type=event_type,
        )
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }


def handle_order_created(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.created event."""
    log_info("Handling order.created event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        log_error("Failed to parse event message in handle_order_created")
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    return process_order_event(message.orderId, "order.created", environment)


def release_hold_and_process_payment(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Dict[str, Any]:
    """
    Release holds and process payment for a completed order.
    This replicates the logic from OrdersService.releaseHoldAndProcessPayment.
    
    Args:
        order_id: Order ID
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Result dictionary with success status
    """
    try:
        log_info("Starting release hold and process payment", order_id=order_id)
        
        # Get complete order details
        order = get_complete_order_details(order_id, hasura_endpoint, hasura_admin_secret)
        
        if not order:
            log_error("Order not found", order_id=order_id)
            return {"success": False, "error": "Order not found"}
        
        if not order.business or not order.business.user_id:
            log_error("Business user not found", order_id=order_id)
            return {"success": False, "error": "Business user not found"}
        
        if not order.client_id or not order.client or not order.client.user_id:
            log_error("Client not found", order_id=order_id)
            return {"success": False, "error": "Client not found"}
        
        # Get or create order hold
        order_hold = get_or_create_order_hold(order_id, order, hasura_endpoint, hasura_admin_secret)
        
        if not order_hold:
            log_error("Failed to get or create order hold", order_id=order_id)
            return {"success": False, "error": "Failed to get or create order hold"}
        
        log_info("Order hold retrieved", order_id=order_id, hold_id=order_hold.id)
        
        # Release agent hold if agent is assigned
        if order.assigned_agent and order.assigned_agent.user_id:
            agent_user_id = order.assigned_agent.user_id
            agent_account = get_account_by_user_and_currency(
                agent_user_id,
                order.currency,
                hasura_endpoint,
                hasura_admin_secret
            )
            
            if agent_account:
                agent_hold_amount = order_hold.agent_hold_amount
                if agent_hold_amount > 0:
                    log_info("Releasing agent hold", order_id=order_id, amount=agent_hold_amount)
                    transaction_id = register_account_transaction(
                        agent_account.id,
                        agent_hold_amount,
                        "release",
                        f"Hold released for order {order.order_number}",
                        order_id,
                        hasura_endpoint,
                        hasura_admin_secret
                    )
                    if transaction_id:
                        log_info("Agent hold released successfully", order_id=order_id, transaction_id=transaction_id)
                    else:
                        log_error("Failed to release agent hold", order_id=order_id)
            else:
                log_error("Agent account not found", order_id=order_id, agent_user_id=agent_user_id)
        
        # Get client account
        client_user_id = order.client.user_id
        client_account = get_account_by_user_and_currency(
            client_user_id,
            order.currency,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not client_account:
            log_error("Client account not found", order_id=order_id, client_user_id=client_user_id)
            return {"success": False, "error": "Client account not found"}
        
        # Release client hold
        client_hold_amount = order_hold.client_hold_amount
        if client_hold_amount > 0:
            log_info("Releasing client hold", order_id=order_id, amount=client_hold_amount)
            transaction_id = register_account_transaction(
                client_account.id,
                client_hold_amount,
                "release",
                f"Hold released for order {order.order_number}",
                order_id,
                hasura_endpoint,
                hasura_admin_secret
            )
            if transaction_id:
                log_info("Client hold released successfully", order_id=order_id, transaction_id=transaction_id)
            else:
                log_error("Failed to release client hold", order_id=order_id)
        
        # Release delivery fees hold
        delivery_fees = order_hold.delivery_fees
        if delivery_fees > 0:
            log_info("Releasing delivery fees hold", order_id=order_id, amount=delivery_fees)
            transaction_id = register_account_transaction(
                client_account.id,
                delivery_fees,
                "release",
                f"Hold released for order {order.order_number} delivery fee",
                order_id,
                hasura_endpoint,
                hasura_admin_secret
            )
            if transaction_id:
                log_info("Delivery fees hold released successfully", order_id=order_id, transaction_id=transaction_id)
            else:
                log_error("Failed to release delivery fees hold", order_id=order_id)
        
        # Process payment transaction
        total_amount = order.total_amount
        log_info("Processing payment transaction", order_id=order_id, amount=total_amount)
        transaction_id = register_account_transaction(
            client_account.id,
            total_amount,
            "payment",
            f"Order payment received for order {order.order_number}",
            order_id,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not transaction_id:
            log_error("Failed to process payment transaction", order_id=order_id)
            return {"success": False, "error": "Failed to process payment transaction"}
        
        log_info("Payment transaction processed successfully", order_id=order_id, transaction_id=transaction_id)
        
        # Note: Commission distribution is complex and involves multiple steps.
        # For now, we'll skip it and log a warning. This should be handled separately
        # via a backend API endpoint or by implementing the full commission logic.
        log_info("Skipping commission distribution - to be handled separately", order_id=order_id)
        
        # Update order hold status to completed
        success = update_order_hold_status(
            order_hold.id,
            "completed",
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not success:
            log_error("Failed to update order hold status", order_id=order_id)
            return {"success": False, "error": "Failed to update order hold status"}
        
        log_info("Release hold and process payment completed successfully", order_id=order_id)
        return {"success": True, "message": "Payment processed successfully"}
        
    except Exception as e:
        log_error("Error in release hold and process payment", error=e, order_id=order_id)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def handle_order_completed(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.completed event."""
    log_info("Handling order.completed event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        log_error("Failed to parse event message in handle_order_completed")
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    hasura_endpoint = os.environ.get("GRAPHQL_ENDPOINT")
    
    if not hasura_endpoint:
        log_error("GRAPHQL_ENDPOINT not configured")
        return {"success": False, "error": "GRAPHQL_ENDPOINT not configured"}
    
    # Get Hasura admin secret
    hasura_admin_secret = get_hasura_admin_secret(environment)
    if not hasura_admin_secret:
        log_error("Failed to retrieve Hasura admin secret")
        return {"success": False, "error": "Failed to retrieve Hasura admin secret"}
    
    # Process payment and release holds
    payment_result = release_hold_and_process_payment(
        message.orderId,
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not payment_result.get("success"):
        log_error("Payment processing failed", order_id=message.orderId, error=payment_result.get("error"))
        # Still try to send notifications even if payment processing fails
        # (for backward compatibility with existing notification logic)
    
    # Also process the order event for notifications (existing behavior)
    notification_result = process_order_event(message.orderId, "order.completed", environment)
    
    # Return combined result
    return {
        "success": payment_result.get("success", False) and notification_result.get("success", False),
        "payment_processing": payment_result,
        "notifications": notification_result,
    }


def handle_order_status_updated(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.status.updated event."""
    log_info("Handling order.status.updated event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        log_error("Failed to parse event message in handle_order_status_updated")
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    event_type = f"order.status.updated.{message.status}" if message.status else "order.status.updated"
    log_info("Processing status update event", status=message.status, event_type=event_type)
    return process_order_event(message.orderId, event_type, environment)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler entry point.
    
    Routes to appropriate handler based on event type in SQS message.
    """
    log_info(
        "Lambda handler invoked",
        request_id=context.aws_request_id if context else "unknown",
        function_name=context.function_name if context else "unknown",
        records_count=len(event.get("Records", [])),
    )
    
    try:
        # Extract records from SQS event
        records = event.get("Records", [])
        
        if not records:
            log_error("No records in event")
            return {
                "success": False,
                "error": "No records in event",
            }
        
        log_info("Processing SQS records", records_count=len(records))
        
        # Process each record (usually one for FIFO queue)
        results = []
        for idx, record in enumerate(records):
            log_info(f"Processing record {idx + 1} of {len(records)}")
            
            message_id = record.get("messageId", "unknown")
            log_info("Processing SQS record", message_id=message_id, record_index=idx)
            
            message = parse_sqs_event_message(record)
            
            if not message:
                log_error("Failed to parse message", message_id=message_id, record_index=idx)
                results.append({"success": False, "error": "Failed to parse message"})
                continue
            
            event_type = message.eventType
            log_info("Routing to event handler", event_type=event_type, order_id=message.orderId)
            
            # Route to appropriate handler
            if event_type == "order.created":
                result = handle_order_created({"Records": [record]})
            elif event_type == "order.completed":
                result = handle_order_completed({"Records": [record]})
            elif event_type == "order.status.updated":
                result = handle_order_status_updated({"Records": [record]})
            else:
                log_error("Unknown event type", event_type=event_type, order_id=message.orderId)
                result = {
                    "success": False,
                    "error": f"Unknown event type: {event_type}",
                }
            
            log_info(
                "Record processing completed",
                message_id=message_id,
                success=result.get("success", False),
                notifications_sent=result.get("notifications_sent", 0),
            )
            
            results.append(result)
        
        # Return results (for FIFO, typically one result)
        log_info("All records processed", total_results=len(results))
        
        if len(results) == 1:
            return results[0]
        
        return {
            "success": True,
            "results": results,
        }
        
    except Exception as e:
        log_error("Unhandled error in Lambda handler", error=e)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }

