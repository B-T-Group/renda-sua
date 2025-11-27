"""SendGrid notification service."""
import os
from typing import List
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from models import AgentLocation, Order
from secrets_manager import get_sendgrid_api_key


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
    if not sendgrid_api_key:
        print("SendGrid API key not found")
        return False
    
    if not template_id:
        print("SendGrid template ID not configured")
        return False
    
    try:
        # Get agent email and name
        agent_user = agent_location.agent.get("user", {})
        agent_email = agent_user.get("email")
        agent_first_name = agent_user.get("first_name", "")
        agent_last_name = agent_user.get("last_name", "")
        agent_name = f"{agent_first_name} {agent_last_name}".strip() or "Agent"
        
        if not agent_email:
            print(f"No email found for agent {agent_location.agent_id}")
            return False
        
        # Format distance
        if distance_km < 1:
            distance_str = f"{distance_km * 1000:.0f} m"
        else:
            distance_str = f"{distance_km:.1f} km"
        
        # Format business address
        business_address = order.business_location.address.format_full_address()
        
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
        
        # Send email
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code >= 200 and response.status_code < 300:
            print(f"Sent notification to agent {agent_email} for order {order.order_number}")
            return True
        else:
            print(f"SendGrid API returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error sending SendGrid notification: {str(e)}")
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
    sendgrid_api_key = get_sendgrid_api_key(environment)
    if not sendgrid_api_key:
        print("SendGrid API key not available")
        return 0
    
    success_count = 0
    
    for agent_location, distance in zip(agent_locations, distances):
        success = send_proximity_notification(
            agent_location,
            order,
            distance,
            sendgrid_api_key,
            template_id
        )
        if success:
            success_count += 1
    
    print(f"Sent {success_count} out of {len(agent_locations)} notifications")
    return success_count

