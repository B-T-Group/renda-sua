# Users Module

This module provides user management functionality for the Rendasua application.

## Users Controller

### Endpoints

#### POST `/users`
Creates a new user record with automatic creation of related records based on user_type_id.

**Request Body:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "user_type_id": "client"
}
```

**For Agent Users:**
```json
{
  "email": "agent@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "user_type_id": "agent",
  "vehicle_type_id": "car"
}
```

**For Business Users:**
```json
{
  "email": "business@example.com",
  "first_name": "Bob",
  "last_name": "Johnson",
  "user_type_id": "business",
  "business_name": "Acme Corporation"
}
```

**Response Examples:**

**Client User:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "identifier": "user123",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type_id": "client",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "client": {
    "id": "uuid",
    "user_id": "uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user123"
}
```

**Agent User:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "identifier": "user456",
    "email": "agent@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "user_type_id": "agent",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "agent": {
    "id": "uuid",
    "user_id": "uuid",
    "vehicle_type_id": "car",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user456"
}
```

**Business User:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "identifier": "user789",
    "email": "business@example.com",
    "first_name": "Bob",
    "last_name": "Johnson",
    "user_type_id": "business",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "business": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Acme Corporation",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user789"
}
```

**Notes:**
- The `identifier` field is automatically extracted from the JWT token's `sub` claim
- Requires a valid JWT token in the Authorization header
- Returns HTTP 400 if the request is invalid or user creation fails
- **For agents**: `vehicle_type_id` is required
- **For businesses**: `business_name` is required
- **For clients**: No additional fields required
- **For other user types**: Only the user record is created (no related records)

## App Controller - Additional Endpoints

### GET `/user-types`
Retrieves all available user types from the database.

**Response:**
```json
{
  "success": true,
  "user_types": [
    {
      "id": "client",
      "name": "Client",
      "description": "Regular client user",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "agent",
      "name": "Agent",
      "description": "Service agent",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "business",
      "name": "Business",
      "description": "Business user",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/vehicle-types`
Retrieves all available vehicle types from the database.

**Response:**
```json
{
  "success": true,
  "vehicle_types": [
    {
      "id": "car",
      "name": "Car",
      "description": "Passenger car",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "motorcycle",
      "name": "Motorcycle",
      "description": "Motorcycle or scooter",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "truck",
      "name": "Truck",
      "description": "Commercial truck",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error messages:
- `"vehicle_type_id is required for agent users"` - When creating an agent without vehicle_type_id
- `"business_name is required for business users"` - When creating a business without business_name

## Authentication

- The users controller requires a valid JWT token in the Authorization header
- The user-types and vehicle-types endpoints use admin privileges via HasuraSystemService
- No authentication required for the reference data endpoints (user-types, vehicle-types)

## Dependencies

- `HasuraModule`: Provides access to Hasura services
- `HasuraUserService`: For user creation operations
- `HasuraSystemService`: For reference data queries 