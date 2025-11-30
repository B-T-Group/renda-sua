"""SendGrid notification service."""
import os
from typing import List
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from rendasua_core_packages.models import AgentLocation, Order
from rendasua_core_packages.secrets_manager import get_sendgrid_api_key
from rendasua_core_packages.utilities import format_full_address


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [notifications] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [notifications] {message}" + (f" | {context_str}" if context_str else "") + error_str)


def send_proximity_notification(
    agent_location: AgentLocation,
    order: Order,
    distance_km: float,
    sendgrid_api_key: str,
    template_id: str
) -> bool:
    """
    Send proximity notification to agent via SendGrid.
    
    Args:
        agent_location: Agent location with user info
        order: Order object
        distance_km: Distance in kilometers
        sendgrid_api_key: SendGrid API key
        template_id: SendGrid template ID
        
    Returns:
        True if successful, False otherwise
    """
    log_info(
        "Preparing to send proximity notification",
        agent_id=agent_location.agent_id,
        order_id=order.id,
        order_number=order.order_number,
        distance_km=round(distance_km, 2),
    )
    
    if not sendgrid_api_key:
        log_error("SendGrid API key not found")
        return False
    
    if not template_id:
        log_error("SendGrid template ID not configured")
        return False
    
    try:
        # Get agent email and name
        agent_user = agent_location.agent.user
        agent_email = agent_user.email
        agent_first_name = agent_user.first_name
        agent_last_name = agent_user.last_name
        agent_name = f"{agent_first_name} {agent_last_name}".strip() or "Agent"
        
        log_info(
            "Agent details retrieved",
            agent_id=agent_location.agent_id,
            agent_email=agent_email,
            agent_name=agent_name,
        )
        
        if not agent_email:
            log_error("No email found for agent", agent_id=agent_location.agent_id)
            return False
        
        # Format distance
        if distance_km < 1:
            distance_str = f"{distance_km * 1000:.0f} m"
        else:
            distance_str = f"{distance_km:.1f} km"
        
        # Format business address (return "NA" if not available)
        if order.business_location and order.business_location.address:
            address = order.business_location.address
            # Check if address has required fields for formatting
            if hasattr(address, 'address_line_1') and address.address_line_1:
                try:
                    business_address = format_full_address(address)
                except (AttributeError, KeyError) as e:
                    # Fallback if address object is missing required fields
                    log_error(
                        "Error formatting address, using fallback",
                        error=e,
                        order_number=order.order_number,
                    )
                    business_address = "NA"
            else:
                business_address = "NA"
        else:
            business_address = "NA"
        
        # Get current year for template
        from datetime import datetime
        current_year = datetime.now().year
        
        # Prepare dynamic template data
        dynamic_template_data = {
            "agent_name": agent_name,
            "order_number": order.order_number,
            "business_name": order.business_location.name,
            "business_address": business_address,
            "distance": distance_str,
            "order_id": order.id,
            "currentYear": current_year,
        }
        
        # Create email message
        message = Mail(
            from_email=os.environ.get("SENDGRID_FROM_EMAIL", "noreply@rendasua.com"),
            to_emails=agent_email,
        )
        message.template_id = template_id
        message.dynamic_template_data = dynamic_template_data
        
        # Validate API key format (SendGrid API keys typically start with 'SG.')
        if not sendgrid_api_key.startswith('SG.'):
            log_error(
                "Invalid SendGrid API key format",
                agent_email=agent_email,
                key_preview=sendgrid_api_key[:8] + "..." if len(sendgrid_api_key) > 8 else "***",
            )
            return False
        
        # Send email
        log_info(
            "Sending email via SendGrid",
            to=agent_email,
            template_id=template_id[:10] + "...",
            order_number=order.order_number,
            api_key_preview=sendgrid_api_key[:8] + "...",
        )
        
        sg = SendGridAPIClient(sendgrid_api_key)
        
        # Get response headers and body for better error debugging
        try:
            response = sg.send(message)
            
            if response.status_code >= 200 and response.status_code < 300:
                log_info(
                    "Notification sent successfully",
                    agent_email=agent_email,
                    order_number=order.order_number,
                    status_code=response.status_code,
                )
                return True
            else:
                # Try to get response body for more details
                response_body = ""
                try:
                    response_body = response.body.decode('utf-8') if response.body else ""
                except:
                    pass
                
                log_error(
                    "SendGrid API returned error status",
                    status_code=response.status_code,
                    agent_email=agent_email,
                    order_number=order.order_number,
                    response_body=response_body[:200] if response_body else "no body",
                )
                return False
        except Exception as send_error:
            log_error(
                "Exception during SendGrid API call",
                error=send_error,
                agent_email=agent_email,
                order_number=order.order_number,
            )
            return False
            
    except Exception as e:
        log_error(
            "Error sending SendGrid notification",
            error=e,
            agent_email=agent_email,
            order_number=order.order_number,
        )
        import traceback
        traceback.print_exc()
        return False


def send_notifications_to_nearby_agents(
    agent_locations: List[AgentLocation],
    order: Order,
    distances: List[float],
    environment: str,
    template_id: str
) -> int:
    """
    Send notifications to all nearby agents.
    
    Args:
        agent_locations: List of nearby agent locations
        order: Order object
        distances: List of distances corresponding to agent locations
        environment: Environment name for secrets
        template_id: SendGrid template ID
        
    Returns:
        Number of successful notifications sent
    """
    log_info(
        "Starting batch notification sending",
        total_agents=len(agent_locations),
        order_id=order.id,
        order_number=order.order_number,
    )
    
    sendgrid_api_key = get_sendgrid_api_key(environment)
    if not sendgrid_api_key:
        log_error("SendGrid API key not available", environment=environment)
        return 0
    
    success_count = 0
    
    for idx, (agent_location, distance) in enumerate(zip(agent_locations, distances), 1):
        log_info(
            f"Sending notification {idx} of {len(agent_locations)}",
            agent_id=agent_location.agent_id,
            distance_km=round(distance, 2),
        )
        
        success = send_proximity_notification(
            agent_location,
            order,
            distance,
            sendgrid_api_key,
            template_id
        )
        if success:
            success_count += 1
    
    log_info(
        "Batch notification sending completed",
        success_count=success_count,
        total_count=len(agent_locations),
        order_id=order.id,
    )
    
    print(f"Sent {success_count} out of {len(agent_locations)} notifications")
    return success_count

