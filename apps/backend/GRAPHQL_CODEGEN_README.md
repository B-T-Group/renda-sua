# GraphQL Code Generation Setup

This document explains the GraphQL code generation setup for the Rendasua backend using Hasura and GraphQL Code Generator.

## Overview

GraphQL Code Generator automatically generates TypeScript types from your GraphQL schema and operations, providing type safety and better developer experience when working with GraphQL APIs.

## Setup

### Dependencies

The following packages have been installed as dev dependencies:

```json
{
  "@graphql-codegen/cli": "^6.0.0",
  "@graphql-codegen/introspection": "^5.0.0",
  "@graphql-codegen/typescript": "^5.0.2",
  "@graphql-codegen/typescript-operations": "^5.0.2",
  "@graphql-codegen/typescript-react-apollo": "^4.3.3"
}
```

### Configuration

The codegen configuration is defined in `codegen.js`:

```javascript
module.exports = {
  schema: [
    {
      'http://localhost:8080/v1/graphql': {
        headers: {
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey',
        },
      },
    },
  ],
  documents: ['./src/**/*.ts', './src/**/*.graphql'],
  overwrite: true,
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        skipTypename: false,
        scalars: {
          uuid: 'string',
          timestamptz: 'string',
          jsonb: 'Record<string, any>',
          numeric: 'number',
        },
      },
    },
    './src/generated/graphql.schema.json': {
      plugins: ['introspection'],
    },
  },
};
```

## Usage

### Running Code Generation

```bash
# Generate types once
npm run codegen

# Watch for changes and auto-regenerate
npm run codegen:watch
```

### Environment Variables

The scripts automatically set the Hasura admin secret. If you need to use a different secret, you can modify the scripts in the `scripts/` directory:

- `scripts/codegen.sh` - For one-time generation
- `scripts/codegen-watch.sh` - For watch mode

## Generated Files

### `src/generated/graphql.ts`

Contains all TypeScript types and interfaces:

- **Scalar Types**: Custom mappings for Hasura-specific types (uuid, timestamptz, jsonb, etc.)
- **Schema Types**: All table types, input types, and enums from your Hasura schema
- **Operation Types**: Generated types for your GraphQL queries and mutations
- **Utility Types**: Helper types for optional fields, exact types, etc.

### `src/generated/graphql.schema.json`

Contains the introspection result of your GraphQL schema in JSON format.

## Writing GraphQL Operations

### Query Example

```typescript
import { gql } from 'graphql-request';

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      first_name
      last_name
      email
      user_type_id
      created_at
      updated_at
    }
  }
`;
```

### Mutation Example

```typescript
import { gql } from 'graphql-request';

export const CREATE_ORDER = gql`
  mutation CreateOrder($input: orders_insert_input!) {
    insert_orders_one(object: $input) {
      id
      order_number
      total_amount
      created_at
    }
  }
`;
```

## Using Generated Types

### Service Implementation

```typescript
import { GraphQLClient } from 'graphql-request';
import { GET_USERS } from '../queries/sample-queries';
import { GetUsersQuery, GetUsersQueryVariables } from '../generated/graphql';

export class UserService {
  private client: GraphQLClient;

  constructor(endpoint: string, adminSecret: string) {
    this.client = new GraphQLClient(endpoint, {
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
    });
  }

  async getUsers(): Promise<GetUsersQuery> {
    const variables: GetUsersQueryVariables = {};
    return await this.client.request<GetUsersQuery>(GET_USERS, variables);
  }
}
```

### Type Safety Benefits

1. **Compile-time validation**: TypeScript will catch errors at compile time
2. **IntelliSense support**: Full autocomplete for GraphQL fields and variables
3. **Refactoring safety**: Renaming fields will update all references
4. **Documentation**: Types serve as living documentation

## Best Practices

### 1. Keep Operations in Separate Files

Organize your GraphQL operations in dedicated files:

```
src/
├── queries/
│   ├── users.queries.ts
│   ├── orders.queries.ts
│   └── index.ts
├── mutations/
│   ├── users.mutations.ts
│   ├── orders.mutations.ts
│   └── index.ts
└── generated/
    ├── graphql.ts
    └── graphql.schema.json
```

### 2. Use Descriptive Operation Names

```typescript
// Good
export const GET_USER_BY_ID = gql`...`;
export const CREATE_USER_PROFILE = gql`...`;

// Bad
export const QUERY1 = gql`...`;
export const MUTATION1 = gql`...`;
```

### 3. Export Types for Reuse

```typescript
// Export commonly used types
export type { Users, Orders, CreateOrderInput } from '../generated/graphql';
```

### 4. Handle Errors Properly

```typescript
try {
  const result = await this.client.request<GetUsersQuery>(GET_USERS, variables);
  return result;
} catch (error: any) {
  console.error('GraphQL Error:', error);
  throw new Error(`Failed to fetch users: ${error.message}`);
}
```

## Integration with NestJS

### Service Example

```typescript
import { Injectable } from '@nestjs/common';
import { GraphQLClient } from 'graphql-request';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GraphQLService {
  private client: GraphQLClient;

  constructor(private configService: ConfigService) {
    this.client = new GraphQLClient(this.configService.get('HASURA_ENDPOINT'), {
      headers: {
        'x-hasura-admin-secret': this.configService.get('HASURA_ADMIN_SECRET'),
      },
    });
  }

  async executeQuery<T>(query: string, variables?: any): Promise<T> {
    return await this.client.request<T>(query, variables);
  }
}
```

## Troubleshooting

### Common Issues

1. **Schema not found**: Ensure Hasura is running and accessible
2. **Authentication errors**: Check your admin secret
3. **Field not found**: Verify field names match your schema
4. **Type errors**: Regenerate types after schema changes

### Debug Commands

```bash
# Check if Hasura is accessible
curl -H "x-hasura-admin-secret: myadminsecretkey" \
     -H "Content-Type: application/json" \
     -d '{"query":"query { __schema { types { name } } }"}' \
     http://localhost:8080/v1/graphql

# Run codegen directly with verbose output
export HASURA_ADMIN_SECRET=myadminsecretkey
npx graphql-codegen --config codegen.js --verbose

# Run the npm script (recommended)
npm run codegen
```

## Workflow

1. **Start Hasura**: Ensure your Hasura instance is running
2. **Write Operations**: Create GraphQL queries/mutations in TypeScript files
3. **Generate Types**: Run `npm run codegen` to generate TypeScript types
4. **Use Types**: Import and use generated types in your services
5. **Iterate**: Modify operations and regenerate types as needed

## Examples

See `src/examples/graphql-codegen-usage.ts` for a complete usage example.

## References

- [GraphQL Code Generator Documentation](https://the-guild.dev/graphql/codegen)
- [Hasura GraphQL API](https://hasura.io/docs/latest/graphql/core/index.html)
- [GraphQL Request](https://github.com/jasonkuhrt/graphql-request)
