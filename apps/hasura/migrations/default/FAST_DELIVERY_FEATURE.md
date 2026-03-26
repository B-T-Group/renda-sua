# Delivery Fee Structure Documentation

## Overview

The delivery fee system has been restructured to provide more transparent and flexible pricing. Delivery fees now consist of two components: a base fee and a per-kilometer fee, with different base fees for standard and fast delivery services.

## Database Schema Changes

### Updated Columns in `orders` Table

1. **`base_delivery_fee`** (DECIMAL(10,2), NOT NULL, DEFAULT 0)

   - Base delivery fee used for this order
   - Uses either `base_delivery_fee` or `fast_delivery_fee` from application_configurations depending on delivery type
   - Must be non-negative (enforced by constraint)

2. **`per_km_delivery_fee`** (DECIMAL(10,2), NOT NULL, DEFAULT 0)
   - Per-kilometer delivery fee calculated as (per_km_rate \* distance)
   - Represents the distance-based component of the delivery fee
   - Must be non-negative (enforced by constraint)

### Removed Columns

- **`delivery_fee`** - Renamed to `base_delivery_fee`
- **`fast_delivery_fee`** - Renamed to `per_km_delivery_fee`

### Constraints

- **`orders_base_delivery_fee_check`**: Ensures `base_delivery_fee >= 0`
- **`orders_per_km_delivery_fee_check`**: Ensures `per_km_delivery_fee >= 0`

## Delivery Fee Calculation

### Formula

```
total_delivery_fee = base_delivery_fee + per_km_delivery_fee
```

### Base Fee Selection

- **Standard Delivery**: Uses `base_delivery_fee` from application_configurations
- **Fast Delivery**: Uses `fast_delivery_fee` from application_configurations as the base fee

### Per-Kilometer Fee

- Calculated as: `per_km_delivery_fee = distance_km * delivery_fee_rate_per_km`
- Distance is calculated using Google Distance Matrix API
- Rate per kilometer is configured in application_configurations

## Configuration Settings

All configurations are stored in the `application_configurations` table with `country_code = 'GA'` (Gabon):

| Config Key                 | Type     | Default Value | Description                     |
| -------------------------- | -------- | ------------- | ------------------------------- |
| `base_delivery_fee`        | currency | 300.00 XAF    | Base fee for standard delivery  |
| `fast_delivery_fee`        | currency | 2000.00 XAF   | Base fee for fast delivery      |
| `delivery_fee_rate_per_km` | currency | 200.00 XAF    | Rate per kilometer              |
| `delivery_fee_min`         | currency | 500.00 XAF    | Minimum total delivery fee      |
| `fast_delivery_time_hours` | number   | 4 hours       | Maximum delivery time window    |
| `fast_delivery_min_hours`  | number   | 2 hours       | Minimum realistic delivery time |
| `fast_delivery_hours`      | json     | (see below)   | Service operating hours by day  |
| `fast_delivery_enabled`    | boolean  | true          | Global feature flag             |

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

### Create Order with New Delivery Fee Structure

```graphql
mutation CreateOrderWithNewDeliveryFee {
  insert_orders_one(
    object: {
      client_id: "client-uuid"
      business_id: "business-uuid"
      business_location_id: "location-uuid"
      delivery_address_id: "address-uuid"
      requires_fast_delivery: true
      base_delivery_fee: 2000.00
      per_km_delivery_fee: 400.00
      subtotal: 15000.00
      total_amount: 17400.00
      currency: "XAF"
      # ... other order fields
    }
  ) {
    id
    order_number
    requires_fast_delivery
    base_delivery_fee
    per_km_delivery_fee
    total_amount
  }
}
```

### Query Orders with New Delivery Fee Structure

```graphql
query GetOrdersWithNewDeliveryFee {
  orders(where: { requires_fast_delivery: { _eq: true }, current_status: { _in: ["pending", "confirmed", "preparing"] } }, order_by: { created_at: desc }) {
    id
    order_number
    requires_fast_delivery
    base_delivery_fee
    per_km_delivery_fee
    total_amount
    estimated_delivery_time
    created_at
  }
}
```

### Update Delivery Fee Components

```graphql
mutation UpdateDeliveryFeeComponents($orderId: uuid!) {
  update_orders_by_pk(pk_columns: { id: $orderId }, _set: { base_delivery_fee: 2000.00, per_km_delivery_fee: 400.00 }) {
    id
    base_delivery_fee
    per_km_delivery_fee
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
   total_amount = subtotal + base_delivery_fee + per_km_delivery_fee + tax_amount
   ```

3. **Fee Breakdown Display**:
   - Show base delivery fee separately
   - Show per-kilometer fee separately
   - Display total delivery fee as sum of both components

### Backend Implementation

1. **Order Processing**:

   - Calculate base delivery fee based on delivery type (standard vs fast)
   - Calculate per-kilometer fee using distance and rate
   - Store both components separately in the database
   - Apply minimum fee constraint if needed

2. **Delivery Fee Calculation**:

   - Use `calculateTieredDeliveryFee` method that returns components separately
   - For fast delivery: `base_fee = fast_delivery_fee` from config
   - For standard delivery: `base_fee = base_delivery_fee` from config
   - `per_km_fee = distance_km * delivery_fee_rate_per_km`

3. **Agent Assignment**:

   - Fast delivery orders should be assigned to available agents first
   - Consider agent proximity for faster pickup

4. **Notifications**:
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
-- Create a test order with new delivery fee structure
INSERT INTO orders (
    client_id,
    business_id,
    business_location_id,
    delivery_address_id,
    requires_fast_delivery,
    base_delivery_fee,
    per_km_delivery_fee,
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
    400.00,
    15000.00,
    17400.00,
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

-- Average delivery fee components
SELECT
    AVG(base_delivery_fee) as avg_base_fee,
    AVG(per_km_delivery_fee) as avg_per_km_fee,
    AVG(base_delivery_fee + per_km_delivery_fee) as avg_total_fee,
    SUM(base_delivery_fee + per_km_delivery_fee) as total_revenue
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Fast delivery vs standard delivery fee comparison
SELECT
    requires_fast_delivery,
    AVG(base_delivery_fee) as avg_base_fee,
    AVG(per_km_delivery_fee) as avg_per_km_fee,
    AVG(base_delivery_fee + per_km_delivery_fee) as avg_total_fee
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY requires_fast_delivery;

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
