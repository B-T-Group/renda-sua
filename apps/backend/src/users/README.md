# Users Module

This module provides user management functionality for the Rendasua application.

## Users Controllers

This controller handles user-related operations including user creation and retrieval.

## Endpoints

### GET /users/me

Retrieves the current user based on the identifier from the JWT token.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Response:**

- **200 OK**: User found successfully
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error

**Success Response Example:**

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "identifier": "user123",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type_id": "client",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user123"
}
```

**Error Response Example:**

```json
{
  "success": false,
  "error": "User not found"
}
```

### POST /users

Creates a new user with the appropriate related record (client, agent, or business) based on the user_type_id.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Request Body:**

```json
{
  "email": "john.doe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "user_type_id": "client|agent|business",
  "vehicle_type_id": "vehicle_type_uuid", // Required for agents
  "business_name": "Business Name" // Required for businesses
}
```

**Response:**

- **200 OK**: User created successfully
- **400 Bad Request**: Invalid request data or missing required fields

**Success Response Examples:**

For Client:

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "identifier": "user123",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type_id": "client",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "client": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user123"
}
```

For Agent:

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "identifier": "user123",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type_id": "agent",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "agent": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "vehicle_type_id": "789e0123-e89b-12d3-a456-426614174000",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user123"
}
```

For Business:

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "identifier": "user123",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type_id": "business",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "business": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Business Name",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "identifier": "user123"
}
```

**Error Response Example:**

```json
{
  "success": false,
  "error": "vehicle_type_id is required for agent users"
}
```

## Logic

The controller automatically creates the appropriate related record based on the `user_type_id`:

- **client**: Creates a user and a client record
- **agent**: Creates a user and an agent record (requires `vehicle_type_id`)
- **business**: Creates a user and a business record (requires `business_name`)
- **other**: Creates only a user record

The `identifier` field is automatically set from the JWT token using the `HasuraUserService.getIdentifier()` method.

## App Controller - Additional Endpoints

The app controller also provides endpoints for fetching reference data:

### GET /user_types

Retrieves all user types from the database.

**Response:**

```json
{
  "success": true,
  "user_types": [
    {
      "id": "client",
      "comment": "Client user type"
    },
    {
      "id": "agent",
      "comment": "Agent user type"
    },
    {
      "id": "business",
      "comment": "Business user type"
    }
  ]
}
```

### GET /vehicle_types

Retrieves all vehicle types from the database.

**Response:**

```json
{
  "success": true,
  "vehicle_types": [
    {
      "id": "car",
      "comment": "Car vehicle type"
    },
    {
      "id": "motorcycle",
      "comment": "Motorcycle vehicle type"
    },
    {
      "id": "truck",
      "comment": "Truck vehicle type"
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
