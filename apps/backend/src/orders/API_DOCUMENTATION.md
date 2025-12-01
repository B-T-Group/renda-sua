# Orders API Documentation

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: Orders API
  description: Order management and status transition APIs
  version: 1.0.0
  contact:
    name: Rendasua API Support
    email: support@rendasua.com

servers:
  - url: http://localhost:3000
    description: Development server
  - url: https://api.rendasua.com
    description: Production server

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    BatchOrderStatusChangeRequest:
      type: object
      required:
        - orderIds
      properties:
        orderIds:
          type: array
          description: List of order IDs to update
          items:
            type: string
            format: uuid
        notes:
          type: string
          description: Optional notes applied to all status changes
          maxLength: 500
        failure_reason_id:
          type: string
          format: uuid
          nullable: true
          description: Optional failure reason (reserved for failed deliveries, not used in batch APIs yet)

    BatchOrderStatusChangeItemResult:
      type: object
      properties:
        orderId:
          type: string
          format: uuid
        success:
          type: boolean
        message:
          type: string
        order:
          $ref: '#/components/schemas/Order'

    BatchOrderStatusChangeResult:
      type: object
      properties:
        success:
          type: boolean
          description: Indicates if at least one order was updated successfully
        results:
          type: array
          items:
            $ref: '#/components/schemas/BatchOrderStatusChangeItemResult'
    OrderStatusChangeRequest:
      type: object
      required:
        - orderId
      properties:
        orderId:
          type: string
          format: uuid
          description: The ID of the order to modify
        notes:
          type: string
          description: Optional notes about the status change
          maxLength: 500

    GetOrderRequest:
      type: object
      required:
        - orderId
      properties:
        orderId:
          type: string
          format: uuid
          description: The ID of the order to assign

    OrderResponse:
      type: object
      properties:
        success:
          type: boolean
        order:
          $ref: '#/components/schemas/Order'
        message:
          type: string

    Order:
      type: object
      properties:
        id:
          type: string
          format: uuid
        order_number:
          type: string
        current_status:
          type: string
          enum: [pending, confirmed, preparing, ready_for_pickup, assigned_to_agent, picked_up, in_transit, out_for_delivery, delivered, cancelled, failed, refunded]
        total_amount:
          type: number
          format: decimal
        currency:
          type: string
          maxLength: 3
        assigned_agent_id:
          type: string
          format: uuid
          nullable: true
        updated_at:
          type: string
          format: date-time

    GetOrderResponse:
      type: object
      properties:
        success:
          type: boolean
        order:
          $ref: '#/components/schemas/Order'
        holdAmount:
          type: number
          format: decimal
          description: Amount held on agent's account
        message:
          type: string

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          description: Error message

paths:
  /orders/confirm:
    post:
      summary: Confirm an order
      description: Confirms an order in pending status. Only business users can confirm orders.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderStatusChangeRequest'
            example:
              orderId: '550e8400-e29b-41d4-a716-446655440000'
              notes: 'Confirmed by business owner'
      responses:
        '200':
          description: Order confirmed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              example:
                success: true
                order:
                  id: '550e8400-e29b-41d4-a716-446655440000'
                  order_number: 'ORD-20241201-000001'
                  current_status: 'confirmed'
                  total_amount: 150.00
                  currency: 'USD'
                  updated_at: '2024-12-01T10:30:00Z'
                message: 'Order confirmed successfully'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Cannot confirm order in confirmed status'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Only business users can confirm orders'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/start_preparing:
    post:
      summary: Start preparing an order
      description: Transitions an order from confirmed to preparing status.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderStatusChangeRequest'
            example:
              orderId: '550e8400-e29b-41d4-a716-446655440000'
              notes: 'Started preparing items'
      responses:
        '200':
          description: Order preparation started successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              example:
                success: true
                order:
                  id: '550e8400-e29b-41d4-a716-446655440000'
                  order_number: 'ORD-20241201-000001'
                  current_status: 'preparing'
                  total_amount: 150.00
                  currency: 'USD'
                  updated_at: '2024-12-01T10:35:00Z'
                message: 'Order preparation started successfully'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Cannot start preparing order in pending status'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Only business users can start preparing orders'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/complete_preparation:
  /orders/batch/start_preparing:
    post:
      summary: Start preparing multiple orders
      description: >
        Business users can transition multiple confirmed orders to preparing
        status in a single operation. Partial success is supported; each order
        is validated individually and the response includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch start preparing'
      responses:
        '200':
          description: Batch start preparing completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/batch/complete_preparation:
    post:
      summary: Complete preparation for multiple orders
      description: >
        Business users can transition multiple preparing orders to
        ready_for_pickup status in a single operation. Partial success is
        supported; each order is validated individually and the response
        includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch complete preparation'
      responses:
        '200':
          description: Batch complete preparation completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/batch/pick_up:
    post:
      summary: Pick up multiple orders
      description: >
        Agents can mark multiple assigned_to_agent orders as picked_up in a
        single operation. Partial success is supported; each order is validated
        individually and the response includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch pick up'
      responses:
        '200':
          description: Batch pick up completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/batch/start_transit:
    post:
      summary: Start transit for multiple orders
      description: >
        Agents can transition multiple picked_up orders to in_transit status in
        a single operation. Partial success is supported; each order is
        validated individually and the response includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch start transit'
      responses:
        '200':
          description: Batch start transit completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/batch/out_for_delivery:
    post:
      summary: Mark multiple orders as out for delivery
      description: >
        Agents can transition multiple in_transit or picked_up orders to
        out_for_delivery status in a single operation. Partial success is
        supported; each order is validated individually and the response
        includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch out for delivery'
      responses:
        '200':
          description: Batch out for delivery completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/batch/deliver:
    post:
      summary: Deliver multiple orders
      description: >
        Agents can transition multiple out_for_delivery orders to delivered
        status in a single operation. Partial success is supported; each order
        is validated individually and the response includes per-order results.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchOrderStatusChangeRequest'
            example:
              orderIds:
                - '550e8400-e29b-41d4-a716-446655440000'
                - '550e8400-e29b-41d4-a716-446655440001'
              notes: 'Batch deliver'
      responses:
        '200':
          description: Batch deliver completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchOrderStatusChangeResult'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: One or more orders not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
    post:
      summary: Complete order preparation
      description: Transitions an order from preparing to ready_for_pickup status.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderStatusChangeRequest'
            example:
              orderId: '550e8400-e29b-41d4-a716-446655440000'
              notes: 'All items prepared and packed'
      responses:
        '200':
          description: Order preparation completed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              example:
                success: true
                order:
                  id: '550e8400-e29b-41d4-a716-446655440000'
                  order_number: 'ORD-20241201-000001'
                  current_status: 'ready_for_pickup'
                  total_amount: 150.00
                  currency: 'USD'
                  updated_at: '2024-12-01T10:40:00Z'
                message: 'Order preparation completed successfully'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Cannot complete preparation for order in confirmed status'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Only business users can complete order preparation'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/get_order:
    post:
      summary: Assign order to agent
      description: Assigns a ready_for_pickup order to an agent with financial hold.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GetOrderRequest'
            example:
              orderId: '550e8400-e29b-41d4-a716-446655440000'
      responses:
        '200':
          description: Order assigned successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetOrderResponse'
              example:
                success: true
                order:
                  id: '550e8400-e29b-41d4-a716-446655440000'
                  order_number: 'ORD-20241201-000001'
                  current_status: 'assigned_to_agent'
                  total_amount: 150.00
                  currency: 'USD'
                  assigned_agent_id: 'agent-123'
                  updated_at: '2024-12-01T10:45:00Z'
                holdAmount: 120.00
                message: 'Order assigned successfully'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: 'Cannot get order in pending status'
        '403':
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                insufficient_balance:
                  summary: Insufficient balance
                  value:
                    success: false
                    error: 'Insufficient balance. Required: 120 USD, Available: 50 USD'
                not_agent:
                  summary: Not an agent
                  value:
                    success: false
                    error: 'Only agent users can get orders'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/{id}/status:
    patch:
      summary: Update order status (legacy)
      description: Legacy endpoint for updating order status. Use specific endpoints for better control.
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: Order ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - status
              properties:
                status:
                  type: string
                  enum: [pending, confirmed, preparing, ready_for_pickup, assigned_to_agent, picked_up, in_transit, out_for_delivery, delivered, cancelled, failed, refunded]
            example:
              status: 'confirmed'
      responses:
        '200':
          description: Order status updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const TOKEN = 'your-jwt-token';

// Confirm an order
async function confirmOrder(orderId, notes) {
  try {
    const response = await axios.post(
      `${API_BASE}/orders/confirm`,
      {
        orderId,
        notes,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error confirming order:', error.response.data);
    throw error;
  }
}

// Start preparing an order
async function startPreparing(orderId, notes) {
  try {
    const response = await axios.post(
      `${API_BASE}/orders/start_preparing`,
      {
        orderId,
        notes,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error starting preparation:', error.response.data);
    throw error;
  }
}

// Complete preparation
async function completePreparation(orderId, notes) {
  try {
    const response = await axios.post(
      `${API_BASE}/orders/complete_preparation`,
      {
        orderId,
        notes,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error completing preparation:', error.response.data);
    throw error;
  }
}

// Get order (agent assignment)
async function getOrder(orderId) {
  try {
    const response = await axios.post(
      `${API_BASE}/orders/get_order`,
      {
        orderId,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting order:', error.response.data);
    throw error;
  }
}

// Example usage
async function processOrder() {
  const orderId = '550e8400-e29b-41d4-a716-446655440000';

  // Business workflow
  await confirmOrder(orderId, 'Confirmed by business owner');
  await startPreparing(orderId, 'Started preparing items');
  await completePreparation(orderId, 'All items prepared and packed');

  // Agent workflow
  const result = await getOrder(orderId);
  console.log(`Order assigned with hold amount: ${result.holdAmount}`);
}
```

### Python

```python
import requests
import json

API_BASE = 'http://localhost:3000'
TOKEN = 'your-jwt-token'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json'
}

def confirm_order(order_id, notes=None):
    """Confirm an order in pending status."""
    data = {'orderId': order_id}
    if notes:
        data['notes'] = notes

    response = requests.post(f'{API_BASE}/orders/confirm',
                           json=data, headers=headers)
    response.raise_for_status()
    return response.json()

def start_preparing(order_id, notes=None):
    """Start preparing an order."""
    data = {'orderId': order_id}
    if notes:
        data['notes'] = notes

    response = requests.post(f'{API_BASE}/orders/start_preparing',
                           json=data, headers=headers)
    response.raise_for_status()
    return response.json()

def complete_preparation(order_id, notes=None):
    """Complete order preparation."""
    data = {'orderId': order_id}
    if notes:
        data['notes'] = notes

    response = requests.post(f'{API_BASE}/orders/complete_preparation',
                           json=data, headers=headers)
    response.raise_for_status()
    return response.json()

def get_order(order_id):
    """Assign order to agent."""
    data = {'orderId': order_id}

    response = requests.post(f'{API_BASE}/orders/get_order',
                           json=data, headers=headers)
    response.raise_for_status()
    return response.json()

# Example usage
if __name__ == '__main__':
    order_id = '550e8400-e29b-41d4-a716-446655440000'

    try:
        # Business workflow
        confirm_order(order_id, 'Confirmed by business owner')
        start_preparing(order_id, 'Started preparing items')
        complete_preparation(order_id, 'All items prepared and packed')

        # Agent workflow
        result = get_order(order_id)
        print(f"Order assigned with hold amount: {result['holdAmount']}")

    except requests.exceptions.HTTPError as e:
        print(f"Error: {e.response.json()}")
```

### cURL Examples

```bash
# Confirm an order
curl -X POST http://localhost:3000/orders/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "notes": "Confirmed by business owner"
  }'

# Start preparing
curl -X POST http://localhost:3000/orders/start_preparing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "notes": "Started preparing items"
  }'

# Complete preparation
curl -X POST http://localhost:3000/orders/complete_preparation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "notes": "All items prepared and packed"
  }'

# Get order (agent assignment)
curl -X POST http://localhost:3000/orders/get_order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Error Codes

| HTTP Status | Error Type            | Description                             |
| ----------- | --------------------- | --------------------------------------- |
| 200         | Success               | Operation completed successfully        |
| 400         | Bad Request           | Invalid request or status transition    |
| 401         | Unauthorized          | Missing or invalid authentication token |
| 403         | Forbidden             | Insufficient permissions or balance     |
| 404         | Not Found             | Order not found                         |
| 500         | Internal Server Error | Server error                            |

## Rate Limiting

- **Default**: 100 requests per minute per user
- **Burst**: 10 requests per second
- **Headers**: Rate limit information included in response headers

## Authentication

All endpoints require JWT authentication:

```bash
Authorization: Bearer <jwt-token>
```

JWT tokens should include:

- `sub`: User ID
- `user_type`: User type (business, agent, client)
- `exp`: Expiration time
