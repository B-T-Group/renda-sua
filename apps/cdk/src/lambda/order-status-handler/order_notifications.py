"""Order status notifications using SendGrid."""
import os
from typing import Optional, Dict, Any, List
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from rendasua_core_packages.secrets_manager import get_sendgrid_api_key


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [order_notifications] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [order_notifications] {message}" + (f" | {context_str}" if context_str else "") + error_str)


# Email template IDs - SendGrid dynamic templates (French versions)
TEMPLATE_IDS = {
    'client_order_cancelled': 'd-9daf143cf57c4976bc9ab294305e4ee1',  # French version
    'business_order_cancelled': 'd-cd12b86e97eb4d57b8d0e1112e55149a',  # French version
    'agent_order_cancelled': 'd-f4c2934d86ac4b0181b0ab20837714ce',  # French version
}


def escape_handlebars_content(content: Any) -> Any:
    """
    Escape special characters for Handlebars templates.
    
    Args:
        content: Content to escape
        
    Returns:
        Escaped content
    """
    if isinstance(content, str):
        # Escape HTML entities and special characters
        return content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#x27;').replace('/', '&#x2F;')
    if isinstance(content, list):
        return [escape_handlebars_content(item) for item in content]
    if content and isinstance(content, dict):
        return {key: escape_handlebars_content(value) for key, value in content.items()}
    return content


def prepare_template_data(data: Dict[str, Any], user_type: str) -> Dict[str, Any]:
    """
    Prepare template data for different user types.
    
    Args:
        data: Notification data dictionary
        user_type: Type of user ('client', 'business', 'agent')
        
    Returns:
        Prepared template data
    """
    if not data:
        raise ValueError('Notification data is undefined')
    
    base_data = {
        'orderId': data.get('orderId', 'Unknown'),
        'orderNumber': data.get('orderNumber', 'Unknown'),
        'orderStatus': data.get('orderStatus', 'Unknown'),
        'orderItems': data.get('orderItems', []),
        'subtotal': data.get('subtotal', 0),
        'deliveryFee': data.get('deliveryFee', 0),
        'taxAmount': data.get('taxAmount', 0),
        'totalAmount': data.get('totalAmount', 0),
        'currency': data.get('currency', 'USD'),
        'deliveryAddress': data.get('deliveryAddress', 'Unknown Address'),
        'estimatedDeliveryTime': data.get('estimatedDeliveryTime'),
        'deliveryTimeWindow': data.get('estimatedDeliveryTime'),
        'specialInstructions': data.get('specialInstructions'),
        'notes': data.get('notes'),
        'businessVerified': data.get('businessVerified', False),
        'currentYear': 2025,  # Will be updated dynamically
    }
    
    from datetime import datetime
    base_data['currentYear'] = datetime.now().year
    
    if user_type == 'client':
        if not data.get('clientName'):
            raise ValueError('Client name is undefined')
        if not data.get('businessName'):
            raise ValueError('Business name is undefined')
        return escape_handlebars_content({
            **base_data,
            'recipientName': data.get('clientName'),
            'businessName': data.get('businessName'),
            'agentName': data.get('agentName', 'Delivery Agent'),
        })
    elif user_type == 'business':
        if not data.get('businessName'):
            raise ValueError('Business name is undefined')
        if not data.get('clientName'):
            raise ValueError('Client name is undefined')
        return escape_handlebars_content({
            **base_data,
            'recipientName': data.get('businessName'),
            'clientName': data.get('clientName'),
            'agentName': data.get('agentName', 'Delivery Agent'),
        })
    elif user_type == 'agent':
        if not data.get('agentName'):
            raise ValueError('Agent name is undefined')
        if not data.get('clientName'):
            raise ValueError('Client name is undefined')
        if not data.get('businessName'):
            raise ValueError('Business name is undefined')
        return escape_handlebars_content({
            **base_data,
            'recipientName': data.get('agentName'),
            'clientName': data.get('clientName'),
            'businessName': data.get('businessName'),
        })
    else:
        return escape_handlebars_content(base_data)


def get_recipients_for_cancellation(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Get recipients for cancellation notification.
    
    Args:
        data: Notification data dictionary
        
    Returns:
        List of recipients with email and type
    """
    recipients = []
    
    # Always notify client and business
    if data.get('clientEmail'):
        recipients.append({'email': data['clientEmail'], 'type': 'client'})
    if data.get('businessEmail'):
        recipients.append({'email': data['businessEmail'], 'type': 'business'})
    
    # Notify agent if assigned
    if data.get('agentEmail'):
        recipients.append({'email': data['agentEmail'], 'type': 'agent'})
    
    return recipients


def send_email(
    to: str,
    template_id: str,
    dynamic_template_data: Dict[str, Any],
    sendgrid_api_key: str,
    from_email: str = 'noreply@rendasua.com'
) -> bool:
    """
    Send email using SendGrid.
    
    Args:
        to: Recipient email address
        template_id: SendGrid template ID
        dynamic_template_data: Template data
        sendgrid_api_key: SendGrid API key
        from_email: From email address
        
    Returns:
        True if successful, False otherwise
    """
    if not to:
        log_error('Recipient email address is required')
        return False
    
    if not template_id:
        log_error('Template ID is required')
        return False
    
    if not dynamic_template_data:
        log_error('Template data is required')
        return False
    
    if not sendgrid_api_key:
        log_error('SendGrid API key not available')
        return False
    
    try:
        message = Mail(
            from_email=from_email,
            to_emails=to,
        )
        message.template_id = template_id
        message.dynamic_template_data = dynamic_template_data
        
        # Validate API key format
        if not sendgrid_api_key.startswith('SG.'):
            log_error(
                'Invalid SendGrid API key format',
                to=to,
                key_preview=sendgrid_api_key[:8] + '...' if len(sendgrid_api_key) > 8 else '***',
            )
            return False
        
        log_info(
            'Sending email via SendGrid',
            to=to,
            template_id=template_id[:10] + '...',
            api_key_preview=sendgrid_api_key[:8] + '...',
        )
        
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if 200 <= response.status_code < 300:
            log_info(
                'Notification sent successfully',
                to=to,
                status_code=response.status_code,
            )
            return True
        else:
            response_body = ''
            try:
                response_body = response.body.decode('utf-8') if response.body else ''
            except:
                pass
            
            log_error(
                'SendGrid API returned error status',
                status_code=response.status_code,
                to=to,
                response_body=response_body[:200] if response_body else 'no body',
            )
            return False
            
    except Exception as e:
        log_error(
            'Error sending SendGrid notification',
            error=e,
            to=to,
        )
        import traceback
        traceback.print_exc()
        return False


def send_cancellation_notifications(
    data: Dict[str, Any],
    environment: str
) -> int:
    """
    Send cancellation notifications to all relevant recipients.
    
    Args:
        data: Notification data dictionary
        environment: Environment name for secrets
        
    Returns:
        Number of successful notifications sent
    """
    log_info(
        'Starting cancellation notification sending',
        order_id=data.get('orderId'),
        order_number=data.get('orderNumber'),
    )
    
    sendgrid_api_key = get_sendgrid_api_key(environment)
    if not sendgrid_api_key:
        log_error('SendGrid API key not available', environment=environment)
        return 0
    
    from_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@rendasua.com')
    
    recipients = get_recipients_for_cancellation(data)
    success_count = 0
    
    for recipient in recipients:
        recipient_type = recipient['type']
        recipient_email = recipient['email']
        template_key = f'{recipient_type}_order_cancelled'
        template_id = TEMPLATE_IDS.get(template_key)
        
        if not template_id:
            log_error(
                'Template ID not found',
                template_key=template_key,
                recipient_type=recipient_type,
            )
            continue
        
        try:
            template_data = prepare_template_data(data, recipient_type)
            success = send_email(
                recipient_email,
                template_id,
                template_data,
                sendgrid_api_key,
                from_email
            )
            if success:
                success_count += 1
        except Exception as e:
            log_error(
                'Error preparing or sending notification',
                error=e,
                recipient_type=recipient_type,
                recipient_email=recipient_email,
            )
    
    log_info(
        'Cancellation notification sending completed',
        success_count=success_count,
        total_count=len(recipients),
        order_id=data.get('orderId'),
    )
    
    return success_count

