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
- Extracts user identifier from JWT sub claim
- Provides methods for creating users, clients, agents, and businesses

### Methods:
- `createUser(userData)`: Creates a new user record
- `createClientRecord(clientData)`: Creates a new client record
- `createAgentRecord(agentData)`: Creates a new agent record
- `createBusinessRecord(businessData)`: Creates a new business record

### Usage:
```typescript
constructor(private hasuraUserService: HasuraUserService) {}

// Create a user
const user = await this.hasuraUserService.createUser({
  email: 'user@example.com',
  name: 'John Doe'
});

// Create a client
const client = await this.hasuraUserService.createClientRecord({
  name: 'Client Name',
  user_id: user.id
});

// Create an agent
const agent = await this.hasuraUserService.createAgentRecord({
  name: 'Agent Name',
  user_id: user.id,
  license_number: 'LIC123456'
});

// Create a business
const business = await this.hasuraUserService.createBusinessRecord({
  name: 'Business Name',
  user_id: user.id,
  business_type: 'LLC',
  registration_number: 'REG123456'
});
```

## API Endpoints

The module includes a controller with the following endpoints:

- `GET /hasura/system/status`: Get system service status
- `POST /hasura/user/create`: Create a new user
- `POST /hasura/user/create-client`: Create a new client
- `POST /hasura/user/create-agent`: Create a new agent
- `POST /hasura/user/create-business`: Create a new business
- `GET /hasura/user/status`: Get user service status

## Database Schema Requirements

The services expect the following tables to exist in Hasura:

### users table:
- id (UUID, primary key)
- email (String, unique)
- name (String, nullable)
- created_at (timestamp)
- updated_at (timestamp)

### clients table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- name (String)
- created_at (timestamp)
- updated_at (timestamp)

### agents table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- name (String)
- license_number (String)
- created_at (timestamp)
- updated_at (timestamp)

### businesses table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- name (String)
- business_type (String)
- registration_number (String)
- created_at (timestamp)
- updated_at (timestamp)

## Security Notes

- The HasuraUserService requires a valid JWT token in the Authorization header
- The JWT token must contain a 'sub' claim with the user identifier
- In production, implement proper JWT validation and authentication guards
- The current JWT decoding is simplified - use a proper JWT library in production 