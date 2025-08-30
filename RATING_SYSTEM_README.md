# Rating System Implementation

This document describes the comprehensive rating system implemented for the Rendasua marketplace platform.

## Overview

The rating system allows users to rate each other and items after order completion, providing valuable feedback for the marketplace ecosystem.

## Features

### Rating Types

- **Client to Agent**: Clients can rate agents after order completion
- **Client to Item**: Clients can rate items after order completion
- **Agent to Client**: Agents can rate clients after order completion

### Key Features

- ✅ Only completed orders can be rated
- ✅ One rating per order per type per user
- ✅ Automatic rating aggregation for performance
- ✅ Public/private rating visibility control
- ✅ Verified ratings from completed orders
- ✅ Comprehensive validation and error handling

## Database Schema

### Tables

#### `ratings`

Stores individual ratings with the following structure:

```sql
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rating_type rating_type_enum NOT NULL,
    rater_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rated_entity_type VARCHAR(20) NOT NULL CHECK (rated_entity_type IN ('agent', 'client', 'item')),
    rated_entity_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `rating_aggregates`

Caches aggregated rating statistics for performance:

```sql
CREATE TABLE public.rating_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('agent', 'client', 'item')),
    entity_id UUID NOT NULL,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    last_rating_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Enums

```sql
CREATE TYPE public.rating_type_enum AS ENUM (
    'client_to_agent',    -- Client rating agent
    'client_to_item',     -- Client rating item
    'agent_to_client'     -- Agent rating client
);
```

### Functions

- `get_user_type(user_uuid UUID)`: Gets user type from profile
- `validate_rating_permission(p_rater_user_id UUID, p_rating_type rating_type_enum)`: Validates rating permissions
- `update_rating_aggregates()`: Automatically updates aggregates when ratings change

## API Endpoints

### POST `/ratings`

Creates a new rating.

**Request Body:**

```json
{
  "orderId": "uuid",
  "ratingType": "client_to_agent",
  "ratedEntityType": "agent",
  "ratedEntityId": "uuid",
  "rating": 5,
  "comment": "Excellent service!",
  "isPublic": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Rating created successfully",
  "rating": {
    "id": "uuid",
    "order_id": "uuid",
    "rating_type": "client_to_agent",
    "rater_user_id": "uuid",
    "rated_entity_type": "agent",
    "rated_entity_id": "uuid",
    "rating": 5,
    "comment": "Excellent service!",
    "is_public": true,
    "is_verified": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

## Business Rules

### Rating Permissions

1. **Order Completion**: Only completed orders can be rated
2. **User Involvement**: Users can only rate orders they were involved in
3. **One Rating Per Type**: Users can only rate once per order per rating type
4. **Entity Validation**: Rated entities must exist in the system

### Validation Rules

- Rating must be between 1 and 5
- Order must exist and be in 'complete' status
- User must be involved in the order (client for client ratings, agent for agent ratings)
- Rated entity must exist (agent, client, or item)
- No duplicate ratings for the same order/type/user combination

## Usage Examples

### Client Rating an Agent

```javascript
const rating = {
  orderId: 'order-uuid',
  ratingType: 'client_to_agent',
  ratedEntityType: 'agent',
  ratedEntityId: 'agent-uuid',
  rating: 5,
  comment: 'Great delivery service!',
};

const response = await fetch('/ratings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(rating),
});
```

### Client Rating an Item

```javascript
const rating = {
  orderId: 'order-uuid',
  ratingType: 'client_to_item',
  ratedEntityType: 'item',
  ratedEntityId: 'item-uuid',
  rating: 4,
  comment: 'Good quality product',
};
```

### Agent Rating a Client

```javascript
const rating = {
  orderId: 'order-uuid',
  ratingType: 'agent_to_client',
  ratedEntityType: 'client',
  ratedEntityId: 'client-uuid',
  rating: 5,
  comment: 'Easy delivery, good communication',
};
```

## Performance Optimizations

### Automatic Aggregation

- Rating aggregates are automatically updated via database triggers
- No manual aggregation needed
- Fast queries for rating statistics

### Indexing

- Comprehensive indexing on frequently queried columns
- Optimized for common query patterns
- Efficient lookups by entity type and ID

## Error Handling

### Common Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "message": "Can only rate completed orders"
}
```

**403 Forbidden**

```json
{
  "success": false,
  "message": "You are not authorized to rate this order"
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Order not found"
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only rate orders they were involved in
3. **Input Validation**: Comprehensive validation of all input data
4. **SQL Injection Protection**: Using parameterized queries via GraphQL
5. **Rate Limiting**: Consider implementing rate limiting for production

## Future Enhancements

### Planned Features

- [ ] Rating moderation system
- [ ] Rating analytics and reporting
- [ ] Rating-based incentives
- [ ] Rating notifications
- [ ] Rating dispute resolution

### Potential Improvements

- [ ] Caching layer for frequently accessed ratings
- [ ] Real-time rating updates
- [ ] Rating trends analysis
- [ ] Integration with recommendation system

## Testing

### Manual Testing

Use the provided test script:

```bash
node test-rating-api.js
```

### API Testing

Test the endpoints using tools like Postman or curl:

```bash
curl -X POST http://localhost:3000/ratings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "test-order-id",
    "ratingType": "client_to_agent",
    "ratedEntityType": "agent",
    "ratedEntityId": "test-agent-id",
    "rating": 5,
    "comment": "Excellent service!"
  }'
```

## Deployment

### Database Migration

```bash
cd apps/hasura
hasura migrate apply --admin-secret myadminsecretkey
hasura metadata apply --admin-secret myadminsecretkey
```

### Backend Deployment

The rating system is automatically included when deploying the backend application.

## Monitoring

### Key Metrics to Monitor

- Rating creation success rate
- Average response times
- Error rates by error type
- Rating distribution patterns
- Aggregate update performance

### Logging

All rating operations are logged for audit purposes and debugging.

## Support

For issues or questions about the rating system:

1. Check the application logs
2. Verify database connectivity
3. Ensure proper authentication
4. Validate input data format
5. Check business rule compliance
