# Orders Module

The Orders module provides comprehensive order management functionality including status transitions, agent assignment, and financial holds.

## Overview

This module handles the complete order lifecycle from creation to delivery, with specific endpoints for different user types (business, agent) to manage order status changes.

## Features

- **Order Status Management**: Controlled status transitions with validation
- **Agent Assignment**: Automatic agent assignment with financial holds
- **Order History**: Complete audit trail of all status changes
- **Financial Controls**: Configurable hold percentages for agent assignments
- **Permission-Based Access**: Role-based access control for different operations

## Configuration

### Environment Variables

```bash
# Agent hold percentage (default: 80)
AGENT_HOLD_PERCENTAGE=80
```

### Configuration Interface

```typescript
export interface OrderConfig {
  agentHoldPercentage: number;
}
```

## API Endpoints

### 1. Confirm Order

**Endpoint:** `POST /orders/confirm`

**Description:** Confirms an order in pending status. Only business users can confirm orders.

**Request Body:**

```typescript
{
  orderId: string;
  notes?: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  order: Order;
  message: string;
}
```

**Status Transitions:**

- `pending` → `confirmed`

**Permissions:** Business users only

**Example:**

```bash
curl -X POST http://localhost:3000/orders/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order-123",
    "notes": "Confirmed by business owner"
  }'
```

### 2. Start Preparing Order

**Endpoint:** `POST /orders/start_preparing`

**Description:** Transitions an order from confirmed to preparing status.

**Request Body:**

```typescript
{
  orderId: string;
  notes?: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  order: Order;
  message: string;
}
```

**Status Transitions:**

- `confirmed` → `preparing`

**Permissions:** Business users only

**Example:**

```bash
curl -X POST http://localhost:3000/orders/start_preparing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order-123",
    "notes": "Started preparing items"
  }'
```

### 3. Complete Preparation

**Endpoint:** `POST /orders/complete_preparation`

**Description:** Transitions an order from preparing to ready_for_pickup status.

**Request Body:**

```typescript
{
  orderId: string;
  notes?: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  order: Order;
  message: string;
}
```

**Status Transitions:**

- `preparing` → `ready_for_pickup`

**Permissions:** Business users only

**Example:**

```bash
curl -X POST http://localhost:3000/orders/complete_preparation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order-123",
    "notes": "All items prepared and packed"
  }'
```

### 4. Get Order (Agent Assignment)

**Endpoint:** `POST /orders/get_order`

**Description:** Assigns a ready_for_pickup order to an agent with financial hold.

**Request Body:**

```typescript
{
  orderId: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  order: Order;
  holdAmount: number;
  message: string;
}
```

**Status Transitions:**

- `ready_for_pickup` → `assigned_to_agent`

**Permissions:** Agent users only

**Financial Hold:**

- Places a hold on 80% (configurable) of the order total
- Requires sufficient available balance
- Returns 403 if insufficient funds

**Example:**

```bash
curl -X POST http://localhost:3000/orders/get_order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order-123"
  }'
```

## Order Status Flow

```
pending → confirmed → preparing → ready_for_pickup → assigned_to_agent → picked_up → in_transit → out_for_delivery → delivered
```

### Status Descriptions

- **pending**: Order created, waiting for business confirmation
- **confirmed**: Order confirmed by business
- **preparing**: Items being prepared/packed
- **ready_for_pickup**: Order ready for agent pickup
- **assigned_to_agent**: Order assigned to delivery agent
- **picked_up**: Agent has picked up the order
- **in_transit**: Order is being delivered
- **out_for_delivery**: Agent is at customer location
- **delivered**: Order successfully delivered
- **cancelled**: Order cancelled (by customer or business)
- **failed**: Delivery failed (customer not available, etc.)
- **refunded**: Order refunded

## Order History

All status changes are automatically logged to the `order_status_history` table with:

- Previous and new status
- User who made the change
- Change type (business, agent, system)
- Optional notes
- Timestamp
- Location data (if available)

## Financial Hold System

### How It Works

1. When an agent gets an order, the system calculates the hold amount
2. Hold amount = Order total × Agent hold percentage (default: 80%)
3. System checks agent's available balance
4. If sufficient, places a "hold" transaction
5. Updates account balances (available_balance - hold, withheld_balance + hold)
6. If insufficient, returns 403 Forbidden

### Hold Transaction Types

- **hold**: Money held for pending order
- **release**: Money released from hold (when order completes)
- **payment**: Payment for completed order

### Configuration

```typescript
// Default hold percentage
AGENT_HOLD_PERCENTAGE = 80;

// Example: 90% hold
AGENT_HOLD_PERCENTAGE = 90;
```

## Error Handling

### Common Error Responses

**403 Forbidden:**

```json
{
  "success": false,
  "error": "Only business users can confirm orders"
}
```

**404 Not Found:**

```json
{
  "success": false,
  "error": "Order not found"
}
```

**400 Bad Request:**

```json
{
  "success": false,
  "error": "Cannot confirm order in confirmed status"
}
```

**403 Forbidden (Insufficient Balance):**

```json
{
  "success": false,
  "error": "Insufficient balance. Required: 80 USD, Available: 50 USD"
}
```

## Testing

### Unit Tests

Run unit tests for the OrdersService:

```bash
npm run test orders.service.spec.ts
```

### Integration Tests

Run integration tests for the OrdersController:

```bash
npm run test orders.controller.spec.ts
```

### Test Coverage

Tests cover:

- ✅ Successful operations
- ✅ Permission validation
- ✅ Status transition validation
- ✅ Financial hold logic
- ✅ Error handling
- ✅ Edge cases

## Database Schema

### Orders Table

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE,
  current_status order_status,
  total_amount DECIMAL(10,2),
  currency VARCHAR(3),
  assigned_agent_id UUID,
  -- ... other fields
);
```

### Order Status History Table

```sql
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  status order_status,
  previous_status order_status,
  changed_by_user_id UUID REFERENCES users(id),
  changed_by_type VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Accounts Table

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  available_balance DECIMAL(18,2),
  withheld_balance DECIMAL(18,2),
  total_balance DECIMAL(18,2),
  currency VARCHAR(3)
);
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Role-based access control (business vs agent)
3. **Ownership**: Users can only modify their own orders
4. **Financial Security**: Hold amounts prevent overspending
5. **Audit Trail**: All changes are logged with user attribution

## Performance Considerations

1. **Indexes**: Database indexes on frequently queried fields
2. **Transactions**: Financial operations use database transactions
3. **Caching**: Consider caching for frequently accessed order data
4. **Pagination**: For order lists, implement pagination

## Monitoring

### Key Metrics

- Order status transition times
- Agent assignment success rates
- Financial hold failures
- API response times
- Error rates by endpoint

### Logging

All operations log:

- User ID and type
- Order ID and status changes
- Financial transactions
- Error details

## Future Enhancements

1. **Bulk Operations**: Support for bulk status updates
2. **Webhooks**: Notifications for status changes
3. **Advanced Analytics**: Order flow analytics
4. **Mobile Push Notifications**: Real-time status updates
5. **Geolocation Tracking**: Enhanced location tracking
6. **Dynamic Hold Percentages**: Per-order or per-agent hold rates
