# Fast Delivery Feature Documentation

## Overview

The fast delivery feature allows customers to request expedited delivery service for their orders, typically with a 2-4 hour delivery window compared to the standard delivery time.

## Database Schema Changes

### New Columns in `orders` Table

1. **`requires_fast_delivery`** (BOOLEAN, NOT NULL, DEFAULT FALSE)

   - Indicates whether the order requires fast delivery service
   - Can be set by clients during order creation or before order confirmation

2. **`fast_delivery_fee`** (DECIMAL(10,2), NOT NULL, DEFAULT 0)
   - Additional fee charged for fast delivery service
   - Added on top of the standard `delivery_fee`
   - Must be non-negative (enforced by constraint)

### Indexes

- **`idx_orders_requires_fast_delivery`**: Partial index on orders where `requires_fast_delivery = TRUE` for efficient filtering

### Constraints

- **`orders_fast_delivery_fee_check`**: Ensures `fast_delivery_fee >= 0`

## Configuration Settings

All configurations are stored in the `application_configurations` table with `country_code = 'GA'` (Gabon):

| Config Key                 | Type     | Default Value | Description                      |
| -------------------------- | -------- | ------------- | -------------------------------- |
| `fast_delivery_fee`        | currency | 2000.00 XAF   | Additional fee for fast delivery |
| `fast_delivery_time_hours` | number   | 4 hours       | Maximum delivery time window     |
| `fast_delivery_min_hours`  | number   | 2 hours       | Minimum realistic delivery time  |
| `fast_delivery_hours`      | json     | (see below)   | Service operating hours by day   |
| `fast_delivery_enabled`    | boolean  | true          | Global feature flag              |

### Fast Delivery Operating Hours

```json
{
  "monday": { "start": "08:00", "end": "20:00", "enabled": true },
  "tuesday": { "start": "08:00", "end": "20:00", "enabled": true },
  "wednesday": { "start": "08:00", "end": "20:00", "enabled": true },
  "thursday": { "start": "08:00", "end": "20:00", "enabled": true },
  "friday": { "start": "08:00", "end": "20:00", "enabled": true },
  "saturday": { "start": "09:00", "end": "18:00", "enabled": true },
  "sunday": { "start": "10:00", "end": "16:00", "enabled": false }
}
```

## Permissions

### Client Role

- **Insert**: Can set `requires_fast_delivery` and `fast_delivery_fee` when creating orders
- **Select**: Can view both columns for their own orders
- **Update**: Can modify both columns for orders in `pending` or `confirmed` status

### Business Role

- **Select**: Can view both columns for orders at their locations
- **Update**: Cannot modify fast delivery settings

### Agent Role

- **Select**: Can view both columns for assigned orders
- **Update**: Cannot modify fast delivery settings

## GraphQL Usage Examples

### Create Order with Fast Delivery

```graphql
mutation CreateOrderWithFastDelivery {
  insert_orders_one(
    object: {
      client_id: "client-uuid"
      business_id: "business-uuid"
      business_location_id: "location-uuid"
      delivery_address_id: "address-uuid"
      requires_fast_delivery: true
      fast_delivery_fee: 2000.00
      delivery_fee: 1500.00
      subtotal: 15000.00
      total_amount: 18500.00
      currency: "XAF"
      # ... other order fields
    }
  ) {
    id
    order_number
    requires_fast_delivery
    fast_delivery_fee
    total_amount
  }
}
```

### Query Orders with Fast Delivery

```graphql
query GetFastDeliveryOrders {
  orders(where: { requires_fast_delivery: { _eq: true }, current_status: { _in: ["pending", "confirmed", "preparing"] } }, order_by: { created_at: desc }) {
    id
    order_number
    requires_fast_delivery
    fast_delivery_fee
    delivery_fee
    total_amount
    estimated_delivery_time
    created_at
  }
}
```

### Update Fast Delivery Setting

```graphql
mutation UpdateFastDelivery($orderId: uuid!) {
  update_orders_by_pk(pk_columns: { id: $orderId }, _set: { requires_fast_delivery: true, fast_delivery_fee: 2000.00 }) {
    id
    requires_fast_delivery
    fast_delivery_fee
  }
}
```

### Get Fast Delivery Configuration

```graphql
query GetFastDeliveryConfig {
  application_configurations(where: { config_key: { _in: ["fast_delivery_fee", "fast_delivery_time_hours", "fast_delivery_enabled"] }, country_code: { _eq: "GA" }, status: { _eq: "active" } }) {
    config_key
    config_name
    data_type
    number_value
    boolean_value
  }
}
```

## Business Logic Considerations

### Frontend Implementation

1. **Order Creation**:

   - Display fast delivery option as a checkbox
   - Fetch `fast_delivery_fee` from configuration
   - Update total amount calculation when toggled
   - Show estimated delivery time window

2. **Total Calculation**:

   ```
   total_amount = subtotal + delivery_fee + fast_delivery_fee + tax_amount
   ```

3. **Availability Check**:
   - Check `fast_delivery_enabled` flag
   - Validate against operating hours
   - Consider business location capabilities

### Backend Implementation

1. **Order Processing**:

   - Validate fast delivery fee against configuration
   - Adjust estimated_delivery_time based on `fast_delivery_time_hours`
   - Priority queue for agents (fast delivery orders first)

2. **Agent Assignment**:

   - Fast delivery orders should be assigned to available agents first
   - Consider agent proximity for faster pickup

3. **Notifications**:
   - Alert agents about fast delivery requirements
   - Send time-sensitive notifications to all parties

## Migrations

### Apply Migrations

```bash
# Navigate to hasura directory
cd apps/hasura

# Apply the migrations
hasura migrate apply --database-name Rendasua

# Or using docker-compose
docker-compose exec hasura hasura-cli migrate apply --database-name Rendasua
```

### Rollback

```bash
# Rollback configurations
hasura migrate apply --version 1759900000000 --type down --database-name Rendasua

# Rollback schema changes
hasura migrate apply --version 1759900000000 --type down --database-name Rendasua
```

## Testing

### Test Scenarios

1. ✅ Create order with fast delivery enabled
2. ✅ Create order without fast delivery (standard)
3. ✅ Update order to enable fast delivery (before confirmation)
4. ✅ Verify fast delivery fee is included in total
5. ✅ Filter orders by fast delivery flag
6. ✅ Check permissions for each role
7. ✅ Verify constraint prevents negative fees
8. ✅ Test configuration updates

### Sample Test Data

```sql
-- Create a test order with fast delivery
INSERT INTO orders (
    client_id,
    business_id,
    business_location_id,
    delivery_address_id,
    requires_fast_delivery,
    fast_delivery_fee,
    delivery_fee,
    subtotal,
    total_amount,
    currency
) VALUES (
    'test-client-uuid',
    'test-business-uuid',
    'test-location-uuid',
    'test-address-uuid',
    true,
    2000.00,
    1500.00,
    15000.00,
    18500.00,
    'XAF'
);
```

## Monitoring & Analytics

### Key Metrics to Track

- Fast delivery adoption rate (% of orders)
- Average fast delivery completion time
- Fast delivery success rate
- Revenue from fast delivery fees
- Customer satisfaction for fast delivery orders

### Useful Queries

```sql
-- Fast delivery adoption rate
SELECT
    COUNT(*) FILTER (WHERE requires_fast_delivery = true) * 100.0 / COUNT(*) as adoption_rate_percent
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Average fast delivery fee collected
SELECT
    AVG(fast_delivery_fee) as avg_fee,
    SUM(fast_delivery_fee) as total_revenue
FROM orders
WHERE requires_fast_delivery = true
  AND created_at >= NOW() - INTERVAL '30 days';

-- Fast delivery completion time
SELECT
    AVG(EXTRACT(EPOCH FROM (actual_delivery_time - created_at))/3600) as avg_hours
FROM orders
WHERE requires_fast_delivery = true
  AND actual_delivery_time IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days';
```

## Future Enhancements

- [ ] Multiple delivery tiers (express, same-day, etc.)
- [ ] Dynamic pricing based on time of day / demand
- [ ] Agent capacity management for fast delivery
- [ ] Guaranteed delivery time with refunds
- [ ] Real-time availability checking
- [ ] Integration with route optimization

## Support

For questions or issues related to the fast delivery feature:

- Check Hasura console for GraphQL queries
- Review migration files for schema details
- Consult application_configurations table for current settings
