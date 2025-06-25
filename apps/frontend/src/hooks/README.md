# Frontend Hooks

This directory contains custom React hooks for the frontend application.

## useApiClient

A custom hook that provides an authenticated Axios instance for making API calls to the backend.

### Features

- **Automatic Authentication**: Automatically includes Auth0 access token in requests
- **Dynamic Setup**: Creates a new Axios instance when user authentication state changes
- **Environment Configuration**: Uses `REACT_APP_API_URL` environment variable for base URL

### Usage

```tsx
import { useApiClient } from '../hooks';

const MyComponent = () => {
  const apiClient = useApiClient();

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/users');
      console.log(response.data);
    } catch (error) {
      console.error('API call failed:', error);
    }
  };

  return (
    <button onClick={fetchData}>
      Fetch Data
    </button>
  );
};
```

## useHasuraClient

A custom hook that provides an authenticated Apollo Client instance for making GraphQL queries to Hasura.

### Features

- **GraphQL Support**: Full Apollo Client integration for GraphQL operations
- **Automatic Authentication**: Includes Auth0 access token in Authorization header
- **Dynamic Setup**: Creates a new Apollo Client when user authentication state changes
- **Error Handling**: Configurable error policies for queries and mutations
- **Caching**: Built-in Apollo Client caching for optimal performance

### Usage

```tsx
import { useHasuraClient } from '../hooks';
import { gql, useQuery } from '@apollo/client';

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

const MyComponent = () => {
  const client = useHasuraClient();

  if (!client) {
    return <div>Loading...</div>;
  }

  return (
    <ApolloProvider client={client}>
      <UserList />
    </ApolloProvider>
  );
};

const UserList = () => {
  const { loading, error, data } = useQuery(GET_USERS);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
};
```

### Environment Variables

Make sure to set the following environment variables:

```env
# For REST API
REACT_APP_API_URL=http://localhost:3000

# For Hasura GraphQL
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
```

### Dependencies

- `axios`: HTTP client for making API requests
- `@apollo/client`: GraphQL client for Hasura operations
- `graphql`: GraphQL language support
- `@auth0/auth0-react`: Authentication library for getting access tokens

### Notes

- The hooks only create authenticated clients when the user is authenticated
- If the user is not authenticated, they return null or basic instances without authentication headers
- The clients are automatically updated when the authentication state changes
- The Hasura client uses Auth0 token in the Authorization header for authentication 