"""Main Lambda handler for order status notifications."""
import json
import os
from dataclasses import dataclass
from rendasua_core_packages.models import Order
from rendasua_core_packages.utilities import format_full_address
from typing import Dict, Any, Optional
from rendasua_core_packages.hasura_client import (
    HasuraClient,
    HasuraClientConfig,
    get_order_with_location,
    get_all_agent_locations,
    get_complete_order_details,
    get_or_create_order_hold,
    get_account_by_user_and_currency,
    register_account_transaction,
    update_order_hold_status,
    get_cancellation_fee_config,
    get_order_business_location_country,
    register_cancellation_fee_transactions,
    get_order_details_for_notification,
)
from rendasua_core_packages.hasura_client.orders_service import create_pending_agent_notification
from rendasua_core_packages.commission_handler import distribute_commissions
from order_notifications import send_cancellation_notifications
from rendasua_core_packages.utilities import calculate_haversine_distance, format_distance
from notifications import send_notifications_to_nearby_agents
from rendasua_core_packages.secrets_manager import get_hasura_admin_secret, get_google_maps_api_key

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

def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
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
            cancelledBy=body.get("cancelledBy"),
            cancellationReason=body.get("cancellationReason"),
            previousStatus=body.get("previousStatus"),
            orderStatus=body.get("orderStatus"),
        )
        log_info(
            "Parsed SQS event message",
            event_type=message.eventType,
            order_id=message.orderId,
            status=message.status,
            cancelled_by=message.cancelledBy,
        )
        return message
    except Exception as e:
        log_error("Error parsing SQS event message", error=e, body=record.get("body", ""))
        return None


def ready_for_pickup_handler(
    order: Order,
    order_id: str,
    event_type: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    environment: str,
    proximity_radius_km: float,
    template_id: str
) -> Dict[str, Any]:
    """
    Handle ready_for_pickup status by creating a pending notification record.
    Notifications will be processed by the scheduled notify-agents Lambda.
    
    Args:
        order: Order object with location data
        order_id: Order ID
        event_type: Type of event
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        environment: Environment name
        proximity_radius_km: Proximity radius in kilometers (not used here, kept for compatibility)
        template_id: SendGrid template ID (not used here, kept for compatibility)
        
    Returns:
        Result dictionary with success status and details
    """
    log_info(
        "Processing ready_for_pickup status - creating pending notification record",
        order_id=order_id,
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
            address=format_full_address(address) if address else "NA",
        )
        return {
            "success": False,
            "error": f"Business location coordinates not available for order {order_id}",
        }
    
    # Create pending notification record
    notification_id = create_pending_agent_notification(
        order_id=order_id,
        notification_type="order_proximity",
        hasura_endpoint=hasura_endpoint,
        hasura_admin_secret=hasura_admin_secret
    )
    
    if notification_id:
        log_info(
            "Pending notification record created successfully",
            order_id=order_id,
            notification_id=notification_id,
        )
        return {
            "success": True,
            "message": f"Created pending notification for {event_type} event",
            "order_id": order_id,
            "notification_id": notification_id,
        }
    else:
        # Notification record may already exist (duplicate event) or creation failed
        log_info(
            "Notification record already exists or creation failed",
            order_id=order_id,
        )
        return {
            "success": True,
            "message": f"Notification record already exists for order {order_id}",
            "order_id": order_id,
        }


def process_order_event(
    order_id: str,
    event_type: str,
    environment: str,
    order_status: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process order event and route to appropriate status handler.
    
    Args:
        order_id: Order ID to process
        event_type: Type of event (order.created, order.completed, order.status.updated)
        environment: Environment name (development or production)
        order_status: Optional order status. If not provided, will be fetched from order.
        
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
            current_status=order.current_status,
        )
        
        # Use provided status or fetch from order
        status = order_status if order_status is not None else order.current_status
        
        if not status:
            log_error("Order status not available", order_id=order_id)
            return {
                "success": False,
                "error": "Order status not available",
            }
        
        log_info("Routing to status handler", order_id=order_id, status=status)
        
        # Route to appropriate handler based on status
        if status == "ready_for_pickup":
            return ready_for_pickup_handler(
                order,
                order_id,
                event_type,
                hasura_endpoint,
                hasura_admin_secret,
                environment,
                proximity_radius_km,
                template_id
            )
        else:
            # No handler for this status - do nothing
            log_info(
                "No handler for status - doing nothing",
                order_id=order_id,
                status=status,
            )
            return {
                "success": True,
                "message": f"No action required for status: {status}",
                "notifications_sent": 0,
                "order_status": status,
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
    # Order status will be fetched from the order in process_order_event
    return process_order_event(message.orderId, "order.created", environment, order_status=None)


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
        
        # Distribute commissions
        log_info("Starting commission distribution", order_id=order_id)
        
        # Create HasuraClient instance for commission distribution
        hasura_client = HasuraClient(
            HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret)
        )
        
        commission_result = distribute_commissions(
            client=hasura_client,
            order_id=order_id
        )
        
        if not commission_result.get("success"):
            log_error(
                "Commission distribution failed",
                order_id=order_id,
                error=commission_result.get("error"),
            )
            # Don't fail the entire process if commission distribution fails
            # Log the error but continue with order hold status update
        else:
            log_info(
                "Commission distribution completed successfully",
                order_id=order_id,
            )
        
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
    try:
        hasura_admin_secret = get_hasura_admin_secret(environment)
    except ValueError as e:
        log_error("Failed to retrieve Hasura admin secret", error=e)
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
    # Order status will be fetched from the order in process_order_event
    notification_result = process_order_event(message.orderId, "order.completed", environment, order_status=None)
    
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
    # Pass the status from the message to process_order_event
    return process_order_event(message.orderId, event_type, environment, order_status=message.status)


def process_cancellation_financials(
    order_id: str,
    cancelled_by: str,
    previous_status: Optional[str],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Dict[str, Any]:
    """
    Process financial transactions for order cancellation.
    
    Args:
        order_id: Order ID
        cancelled_by: Who cancelled ('client' or 'business')
        previous_status: Order status before cancellation
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Result dictionary with success status
    """
    try:
        log_info("Starting cancellation financial processing", order_id=order_id, cancelled_by=cancelled_by, previous_status=previous_status)
        
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
        
        # Process cancellation fee
        cancellation_fee = 0.0
        if cancelled_by == "client" and previous_status and previous_status in ["confirmed", "preparing", "ready_for_pickup"]:
            # Client cancelling after confirmation - fee applies
            log_info("Client cancelled after confirmation, checking for cancellation fee", order_id=order_id, previous_status=previous_status)
            
            # Get country code from business location
            country_code = get_order_business_location_country(order_id, hasura_endpoint, hasura_admin_secret)
            if not country_code:
                log_info("Country code not found, defaulting to GA", order_id=order_id)
                country_code = "GA"
            
            # Get cancellation fee
            cancellation_fee = get_cancellation_fee_config(country_code, hasura_endpoint, hasura_admin_secret)
            if cancellation_fee is None:
                log_info("Cancellation fee config not found, no fee will be charged", order_id=order_id, country_code=country_code)
                cancellation_fee = 0.0
            else:
                log_info("Cancellation fee found", order_id=order_id, fee=cancellation_fee, country_code=country_code)
                
                # Get business account
                business_user_id = order.business.user_id
                business_account = get_account_by_user_and_currency(
                    business_user_id,
                    order.currency,
                    hasura_endpoint,
                    hasura_admin_secret
                )
                
                if not business_account:
                    log_error("Business account not found", order_id=order_id, business_user_id=business_user_id)
                    return {"success": False, "error": "Business account not found"}
                
                # Register cancellation fee transactions
                fee_result = register_cancellation_fee_transactions(
                    order_id,
                    order.order_number,
                    client_account.id,
                    business_account.id,
                    cancellation_fee,
                    order.currency,
                    hasura_endpoint,
                    hasura_admin_secret
                )
                
                if not fee_result.get("success"):
                    log_error("Failed to register cancellation fee transactions", order_id=order_id, error=fee_result.get("error"))
                    return {"success": False, "error": "Failed to process cancellation fee"}
                
                log_info("Cancellation fee transactions registered successfully", order_id=order_id)
        
        elif cancelled_by == "business":
            # Business cancelling - no fee to client
            log_info("Business cancelled order, no cancellation fee", order_id=order_id)
        
        # Release client hold (minus cancellation fee if applicable)
        client_hold_amount = order_hold.client_hold_amount
        refund_amount = client_hold_amount - cancellation_fee
        
        if refund_amount > 0:
            log_info("Releasing client hold", order_id=order_id, amount=refund_amount, cancellation_fee=cancellation_fee)
            transaction_id = register_account_transaction(
                client_account.id,
                refund_amount,
                "release",
                f"Hold released for order {order.order_number}" + (f" (cancellation fee: {cancellation_fee} deducted)" if cancellation_fee > 0 else ""),
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
        
        # Update order hold status to cancelled
        success = update_order_hold_status(
            order_hold.id,
            "cancelled",
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not success:
            log_error("Failed to update order hold status", order_id=order_id)
            return {"success": False, "error": "Failed to update order hold status"}
        
        log_info("Cancellation financial processing completed successfully", order_id=order_id, cancellation_fee=cancellation_fee)
        return {"success": True, "cancellation_fee": cancellation_fee}
        
    except Exception as e:
        log_error("Error in cancellation financial processing", error=e, order_id=order_id)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def handle_order_cancelled(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.cancelled event."""
    log_info("Handling order.cancelled event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        log_error("Failed to parse event message in handle_order_cancelled")
        return {"success": False, "error": "Failed to parse event message"}
    
    if not message.cancelledBy:
        log_error("cancelledBy not found in cancellation message", order_id=message.orderId)
        return {"success": False, "error": "cancelledBy not found in message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    hasura_endpoint = os.environ.get("GRAPHQL_ENDPOINT")
    
    if not hasura_endpoint:
        log_error("GRAPHQL_ENDPOINT not configured")
        return {"success": False, "error": "GRAPHQL_ENDPOINT not configured"}
    
    # Get Hasura admin secret
    try:
        hasura_admin_secret = get_hasura_admin_secret(environment)
    except ValueError as e:
        log_error("Failed to retrieve Hasura admin secret", error=e)
        return {"success": False, "error": "Failed to retrieve Hasura admin secret"}
    
    # Process cancellation financials
    financial_result = process_cancellation_financials(
        message.orderId,
        message.cancelledBy,
        message.previousStatus,
        hasura_endpoint,
        hasura_admin_secret
    )
    
    if not financial_result.get("success"):
        log_error("Cancellation financial processing failed", order_id=message.orderId, error=financial_result.get("error"))
        # Continue even if financial processing fails - order is already cancelled
    
    # Send cancellation notifications
    try:
        # Get order details for notifications
        order_notification_data = get_order_details_for_notification(
            message.orderId,
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if order_notification_data:
            # Add cancellation reason to notification data
            if message.cancellationReason:
                order_notification_data["notes"] = message.cancellationReason
            
            # Send notifications
            notifications_sent = send_cancellation_notifications(
                order_notification_data,
                environment
            )
            log_info(
                "Cancellation notifications sent",
                order_id=message.orderId,
                notifications_sent=notifications_sent,
            )
        else:
            log_error("Failed to fetch order details for notifications", order_id=message.orderId)
    except Exception as e:
        log_error(
            "Error sending cancellation notifications",
            error=e,
            order_id=message.orderId,
        )
        # Don't fail the entire process if notifications fail
    
    return {
        "success": financial_result.get("success", False),
        "financial_processing": financial_result,
        "cancellation_fee": financial_result.get("cancellation_fee", 0),
    }


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
            elif event_type == "order.cancelled":
                result = handle_order_cancelled({"Records": [record]})
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

