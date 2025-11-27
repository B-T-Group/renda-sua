"""Main Lambda handler for order status notifications."""
import json
import os
from typing import Dict, Any, Optional
from models import Order, AgentLocation, SQSEventMessage
from hasura_client import get_order_with_location, get_all_agent_locations
from distance import calculate_haversine_distance, format_distance
from notifications import send_notifications_to_nearby_agents
from secrets_manager import get_hasura_admin_secret, get_google_maps_api_key


def extract_order_id_from_sqs_record(record: Dict[str, Any]) -> Optional[str]:
    """Extract order ID from SQS record."""
    try:
        body = json.loads(record.get("body", "{}"))
        return body.get("orderId")
    except Exception as e:
        print(f"Error extracting order ID from SQS record: {str(e)}")
        return None


def parse_sqs_event_message(record: Dict[str, Any]) -> Optional[SQSEventMessage]:
    """Parse SQS event message from record."""
    try:
        body = json.loads(record.get("body", "{}"))
        return SQSEventMessage(
            eventType=body.get("eventType"),
            orderId=body.get("orderId"),
            timestamp=body.get("timestamp"),
            status=body.get("status"),
        )
    except Exception as e:
        print(f"Error parsing SQS event message: {str(e)}")
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
        # Get configuration
        hasura_endpoint = os.environ.get("GRAPHQL_ENDPOINT")
        proximity_radius_km = float(os.environ.get("PROXIMITY_RADIUS_KM", "10"))
        template_id = os.environ.get("SENDGRID_ORDER_PROXIMITY_TEMPLATE_ID", "")
        
        if not hasura_endpoint:
            return {
                "success": False,
                "error": "GRAPHQL_ENDPOINT not configured",
            }
        
        # Get secrets
        hasura_admin_secret = get_hasura_admin_secret(environment)
        google_maps_api_key = get_google_maps_api_key(environment)
        
        # Fetch order with location
        order = get_order_with_location(
            order_id,
            hasura_endpoint,
            hasura_admin_secret,
            google_maps_api_key
        )
        
        if not order:
            return {
                "success": False,
                "error": f"Order {order_id} not found",
            }
        
        # Check if business location has coordinates
        address = order.business_location.address
        if address.latitude is None or address.longitude is None:
            return {
                "success": False,
                "error": f"Business location coordinates not available for order {order_id}",
            }
        
        # Fetch all agent locations
        agent_locations = get_all_agent_locations(
            hasura_endpoint,
            hasura_admin_secret
        )
        
        if not agent_locations:
            print(f"No agent locations found")
            return {
                "success": True,
                "message": "No agents available",
                "notifications_sent": 0,
            }
        
        # Calculate distances and filter nearby agents
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
                print(
                    f"Agent {agent_location.agent_id} is {format_distance(distance)} away"
                )
        
        if not nearby_agents:
            print(f"No agents within {proximity_radius_km}km of business location")
            return {
                "success": True,
                "message": f"No agents within {proximity_radius_km}km",
                "notifications_sent": 0,
            }
        
        # Send notifications to nearby agents
        notifications_sent = send_notifications_to_nearby_agents(
            nearby_agents,
            order,
            distances,
            environment,
            template_id
        )
        
        return {
            "success": True,
            "message": f"Processed {event_type} event",
            "order_id": order_id,
            "nearby_agents_count": len(nearby_agents),
            "notifications_sent": notifications_sent,
        }
        
    except Exception as e:
        print(f"Error processing order event: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }


def handle_order_created(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.created event."""
    print("Handling order.created event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    return process_order_event(message.orderId, "order.created", environment)


def handle_order_completed(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.completed event."""
    print("Handling order.completed event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    return process_order_event(message.orderId, "order.completed", environment)


def handle_order_status_updated(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order.status.updated event."""
    print("Handling order.status.updated event")
    
    record = event.get("Records", [{}])[0]
    message = parse_sqs_event_message(record)
    
    if not message:
        return {"success": False, "error": "Failed to parse event message"}
    
    environment = os.environ.get("ENVIRONMENT", "development")
    event_type = f"order.status.updated.{message.status}" if message.status else "order.status.updated"
    return process_order_event(message.orderId, event_type, environment)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler entry point.
    
    Routes to appropriate handler based on event type in SQS message.
    """
    print(f"Received event: {json.dumps(event)}")
    
    try:
        # Extract records from SQS event
        records = event.get("Records", [])
        
        if not records:
            return {
                "success": False,
                "error": "No records in event",
            }
        
        # Process each record (usually one for FIFO queue)
        results = []
        for record in records:
            message = parse_sqs_event_message(record)
            
            if not message:
                results.append({"success": False, "error": "Failed to parse message"})
                continue
            
            event_type = message.eventType
            
            # Route to appropriate handler
            if event_type == "order.created":
                result = handle_order_created({"Records": [record]})
            elif event_type == "order.completed":
                result = handle_order_completed({"Records": [record]})
            elif event_type == "order.status.updated":
                result = handle_order_status_updated({"Records": [record]})
            else:
                result = {
                    "success": False,
                    "error": f"Unknown event type: {event_type}",
                }
            
            results.append(result)
        
        # Return results (for FIFO, typically one result)
        if len(results) == 1:
            return results[0]
        
        return {
            "success": True,
            "results": results,
        }
        
    except Exception as e:
        print(f"Error in Lambda handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
        }

