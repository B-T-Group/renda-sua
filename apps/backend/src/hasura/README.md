# Hasura Services

This module provides two services for interacting with Hasura GraphQL Engine:

## HasuraSystemService

A singleton service that provides admin-level access to Hasura using the master secret.

### Features:
- Creates GraphQL clients with admin privileges
- Executes queries and mutations with admin access
- Uses environment variables for configuration

### Environment Variables:
- `HASURA_GRAPHQL_ENDPOINT`: Hasura GraphQL endpoint (default: http://localhost:8080/v1/graphql)
- `HASURA_GRAPHQL_ADMIN_SECRET`: Hasura admin secret (default: myadminsecretkey)

### Usage:
```typescript
constructor(private hasuraSystemService: HasuraSystemService) {}

// Execute a query
const result = await this.hasuraSystemService.executeQuery(`
  query GetUsers {
    users {
      id
      email
    }
  }
`);

// Execute a mutation
const result = await this.hasuraSystemService.executeMutation(`
  mutation CreateUser($email: String!) {
    insert_users_one(object: { email: $email }) {
      id
      email
    }
  }
`, { email: 'user@example.com' });
```

## HasuraUserService

A request-scoped service that provides user-level access to Hasura using JWT tokens.

### Features:
- Request-scoped (new instance per request)
- Extracts JWT token from Authorization header
- Extracts user identifier from JWT sub claim and uses it for user creation
- Provides nested query methods for creating users with related records

### Methods:
- `createUser(userData)`: Creates a new user record
- `createUserWithClient(userData)`: Creates user and client records in a single transaction
- `createUserWithAgent(userData, agentData)`: Creates user and agent records in a single transaction
- `createUserWithBusiness(userData, businessData)`: Creates user and business records in a single transaction

### User Data Structure:
```typescript
{
  email: string;         // User email address
  first_name: string;    // User's first name
  last_name: string;     // User's last name
  user_type_id: string;  // User type identifier
}
```

**Note**: The `identifier` field is automatically extracted from the JWT token's `sub` claim and does not need to be provided in the request.

### Usage:
```typescript
constructor(private hasuraUserService: HasuraUserService) {}

// Create a user only
const user = await this.hasuraUserService.createUser({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe',
  user_type_id: 'client'
});

// Create a user with client record (nested query)
const result = await this.hasuraUserService.createUserWithClient({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe',
  user_type_id: 'client'
});

// Create a user with agent record (nested query)
const result = await this.hasuraUserService.createUserWithAgent(
  {
    email: 'agent@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    user_type_id: 'agent'
  },
  {
    vehicle_type_id: 'car'
  }
);

// Create a user with business record (nested query)
const result = await this.hasuraUserService.createUserWithBusiness(
  {
    email: 'business@example.com',
    first_name: 'Bob',
    last_name: 'Johnson',
    user_type_id: 'business'
  },
  {
    name: 'Business Name'
  }
);
```

## API Endpoints

The module includes a controller with the following endpoints:

- `GET /hasura/system/status`: Get system service status
- `POST /hasura/user/create`: Create a new user
- `POST /hasura/user/create-with-client`: Create user with client record
- `POST /hasura/user/create-with-agent`: Create user with agent record
- `POST /hasura/user/create-with-business`: Create user with business record
- `GET /hasura/user/status`: Get user service status

### Example API Requests:

#### Create User with Client:
```json
POST /hasura/user/create-with-client
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "user_type_id": "client"
}
```

#### Create User with Agent:
```json
POST /hasura/user/create-with-agent
{
  "user": {
    "email": "agent@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "user_type_id": "agent"
  },
  "agent": {
    "vehicle_type_id": "car"
  }
}
```

#### Create User with Business:
```json
POST /hasura/user/create-with-business
{
  "user": {
    "email": "business@example.com",
    "first_name": "Bob",
    "last_name": "Johnson",
    "user_type_id": "business"
  },
  "business": {
    "name": "Business Name"
  }
}
```

## Database Schema

The services work with the following actual database schema:

### users table:
- id (UUID, primary key)
- identifier (String, unique) - **Extracted from JWT token**
- email (String, unique)
- first_name (String)
- last_name (String)
- user_type_id (String, foreign key to user_types.id)
- created_at (timestamp)
- updated_at (timestamp)

### clients table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- created_at (timestamp)
- updated_at (timestamp)

### agents table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- vehicle_type_id (String, foreign key to vehicle_types.id)
- created_at (timestamp)
- updated_at (timestamp)

### businesses table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- name (String)
- created_at (timestamp)
- updated_at (timestamp)

### Required Relationships:
- users -> clients (one-to-many)
- users -> agents (one-to-many)
- users -> businesses (one-to-many)
- users -> user_types (many-to-one)
- agents -> vehicle_types (many-to-one)

## Nested Query Benefits

The nested query approach provides several advantages:

1. **Atomic Operations**: User and related records are created in a single transaction
2. **Data Consistency**: If any part fails, the entire operation is rolled back
3. **Performance**: Single database round-trip instead of multiple queries
4. **Simplified Error Handling**: No need to handle partial failures
5. **Automatic Foreign Key Management**: Hasura handles the relationships automatically

## Security Notes

- The HasuraUserService requires a valid JWT token in the Authorization header
- The JWT token must contain a 'sub' claim with the user identifier
- The identifier from the JWT token is automatically used for user creation
- In production, implement proper JWT validation and authentication guards
- The current JWT decoding is simplified - use a proper JWT library in production 