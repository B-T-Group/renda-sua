# Notifications Module

This module provides comprehensive email notification functionality for the Rendasua order management system using SendGrid.

## Overview

The notifications system automatically sends email notifications to clients, businesses, and agents whenever:

- An order is created
- An order status changes

## Features

- **SendGrid Integration**: Uses SendGrid for reliable email delivery
- **Template-based Emails**: Professional HTML email templates for all scenarios
- **Multi-recipient Support**: Sends appropriate notifications to different user types
- **Error Handling**: Graceful failure handling that doesn't break order operations
- **Configurable**: Easy to configure via environment variables

## Email Templates

The system includes the following email templates:

### Order Creation

- `client_order_created.html` - Client notification when order is placed
- `business_order_created.html` - Business notification when new order is received

### Order Status Changes

- `client_order_confirmed.html` - Client notification when order is confirmed
- `business_order_confirmed.html` - Business notification when order is confirmed
- `client_order_preparing.html` - Client notification when order is being prepared
- `business_order_preparing.html` - Business notification when order is being prepared
- `client_order_ready_for_pickup.html` - Client notification when order is ready for pickup
- `business_order_ready_for_pickup.html` - Business notification when order is ready for pickup
- `agent_order_assigned.html` - Agent notification when order is assigned
- `client_order_picked_up.html` - Client notification when order is picked up
- `business_order_picked_up.html` - Business notification when order is picked up
- `agent_order_picked_up.html` - Agent notification when order is picked up
- `client_order_in_transit.html` - Client notification when order is in transit
- `business_order_in_transit.html` - Business notification when order is in transit
- `agent_order_in_transit.html` - Agent notification when order is in transit
- `client_order_out_for_delivery.html` - Client notification when order is out for delivery
- `business_order_out_for_delivery.html` - Business notification when order is out for delivery
- `agent_order_out_for_delivery.html` - Agent notification when order is out for delivery
- `client_order_delivered.html` - Client notification when order is delivered
- `business_order_delivered.html` - Business notification when order is delivered
- `agent_order_delivered.html` - Agent notification when order is delivered
- `client_order_cancelled.html` - Client notification when order is cancelled
- `business_order_cancelled.html` - Business notification when order is cancelled
- `agent_order_cancelled.html` - Agent notification when order is cancelled
- `client_order_failed.html` - Client notification when delivery fails
- `business_order_failed.html` - Business notification when delivery fails
- `agent_order_failed.html` - Agent notification when delivery fails
- `client_order_refunded.html` - Client notification when order is refunded
- `business_order_refunded.html` - Business notification when order is refunded

## Configuration

### Environment Variables

Add these environment variables to your configuration:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@rendasua.com
```

### SendGrid Setup

1. **Create SendGrid Account**: Sign up at [SendGrid](https://sendgrid.com/)
2. **Generate API Key**: Create an API key with mail send permissions
3. **Create Dynamic Templates**: Upload the HTML templates to SendGrid and get their IDs
4. **Update Template IDs**: Update the `templateIds` object in `notifications.service.ts` with the actual SendGrid template IDs

### Template IDs

The service uses placeholder template IDs that need to be replaced with actual SendGrid template IDs:

```typescript
private readonly templateIds = {
  client_order_created: 'd-client-order-created', // Replace with actual ID
  business_order_created: 'd-business-order-created', // Replace with actual ID
  // ... other templates
};
```

## Usage

### Automatic Notifications

Notifications are automatically sent when:

1. **Order Creation**: When `OrdersService.createOrder()` is called
2. **Status Changes**: When `OrderStatusService.updateOrderStatus()` is called

### Manual Testing

Use the notification controller endpoints for testing:

```bash
# Test order creation notifications
POST /notifications/test-order-created
{
  "orderId": "uuid",
  "orderNumber": "12345678",
  "clientName": "John Doe",
  "clientEmail": "client@example.com",
  "businessName": "Business Name",
  "businessEmail": "business@example.com",
  "orderStatus": "pending",
  "orderItems": [...],
  "subtotal": 100,
  "deliveryFee": 10,
  "taxAmount": 5,
  "totalAmount": 115,
  "currency": "USD",
  "deliveryAddress": "123 Main St, City, State"
}

# Test status change notifications
POST /notifications/test-status-change
{
  "data": { /* notification data */ },
  "previousStatus": "pending"
}
```

## Integration Points

### Orders Service

The `OrdersService.createOrder()` method automatically sends notifications to:

- Client (order confirmation)
- Business (new order alert)

### Order Status Service

The `OrderStatusService.updateOrderStatus()` method automatically sends notifications based on the new status:

- **confirmed**: Client + Business
- **preparing**: Client + Business
- **ready_for_pickup**: Client + Business
- **assigned_to_agent**: Agent only
- **picked_up**: Client + Business + Agent
- **in_transit**: Client + Business + Agent
- **out_for_delivery**: Client + Business + Agent
- **delivered**: Client + Business + Agent
- **cancelled**: Client + Business + Agent (if assigned)
- **failed**: Client + Business + Agent (if assigned)
- **refunded**: Client + Business

## Error Handling

- Notifications are sent asynchronously and don't block order operations
- If notification sending fails, it's logged but doesn't affect the order process
- The system gracefully handles missing SendGrid configuration

## Template Variables

All templates support the following variables:

### Common Variables

- `orderId` - Order UUID
- `orderNumber` - Human-readable order number
- `orderStatus` - Current order status
- `orderItems` - Array of order items
- `subtotal` - Order subtotal
- `deliveryFee` - Delivery fee
- `taxAmount` - Tax amount
- `totalAmount` - Total order amount
- `currency` - Currency code
- `deliveryAddress` - Delivery address
- `estimatedDeliveryTime` - Estimated delivery time
- `specialInstructions` - Special delivery instructions
- `currentYear` - Current year for copyright

### User-specific Variables

- `recipientName` - Name of the email recipient
- `clientName` - Client's name
- `businessName` - Business name
- `agentName` - Agent's name (when applicable)

## Development

### Adding New Templates

1. Create HTML template in `templates/` directory
2. Add template ID to `templateIds` object in service
3. Update recipient logic in `getRecipientsForStatus()` method
4. Test with notification controller endpoints

### Template Styling

Templates use inline CSS for maximum email client compatibility. Key styling guidelines:

- Use inline styles
- Test across different email clients
- Keep responsive design simple
- Use web-safe fonts
- Include fallback colors

## Monitoring

Monitor notification delivery through:

- SendGrid dashboard for delivery statistics
- Application logs for error tracking
- SendGrid webhook events for detailed delivery status

## Security

- API keys are stored securely in environment variables
- Email addresses are validated before sending
- Templates are sanitized to prevent injection attacks
- Rate limiting is handled by SendGrid
