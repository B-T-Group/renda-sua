# Frontend Hooks

This directory contains custom React hooks for the Rendasua frontend application.

## Available Hooks

### API Client Hook

**File:** `useApiClient.ts`

A hook that provides an axios client instance with Auth0 token authentication.

```typescript
import { useApiClient } from '../hooks';

const MyComponent = () => {
  const apiClient = useApiClient();
  
  const fetchData = async () => {
    const response = await apiClient.get('/api/endpoint');
    return response.data;
  };
};
```

**Environment Variables:**
- `REACT_APP_API_URL`: Backend API base URL

### Hasura Client Hook

**File:** `useHasuraClient.ts`

A hook that provides an Apollo Client instance for GraphQL operations with Auth0 token authentication.

```typescript
import { useHasuraClient } from '../hooks';
import { gql, useQuery } from '@apollo/client';

const MyComponent = () => {
  const hasuraClient = useHasuraClient();
  
  const { data, loading, error } = useQuery(gql`
    query GetUsers {
      users {
        id
        email
        first_name
        last_name
      }
    }
  `, { client: hasuraClient });
};
```

**Environment Variables:**
- `REACT_APP_HASURA_URL`: Hasura GraphQL endpoint URL

### Combined Clients Hook

**File:** `useClients.ts`

A utility hook that provides both API and Hasura clients in a single object.

```typescript
import { useClients } from '../hooks';

const MyComponent = () => {
  const { apiClient, hasuraClient } = useClients();
  
  // Use either client as needed
};
```

### Login Flow Hook

**File:** `useLoginFlow.ts`

A hook that handles the complete login flow, including checking if the user has a complete profile and redirecting accordingly.

```typescript
import { useLoginFlow } from '../hooks';

const App = () => {
  const { isCheckingProfile, isAuthenticated, isLoading, user } = useLoginFlow();
  
  // The hook automatically:
  // 1. Checks if user is authenticated
  // 2. Makes a GET request to /users/me endpoint
  // 3. Redirects to /dashboard if profile exists
  // 4. Redirects to /complete-profile if 404 (no profile)
  
  if (isLoading || isCheckingProfile) {
    return <LoadingPage />;
  }
  
  return <MainApp />;
};
```

**Flow:**
1. User logs in with Auth0
2. Hook makes GET request to `/users/me`
3. If 200: User has complete profile → redirect to `/dashboard`
4. If 404: User needs to complete profile → redirect to `/complete-profile`
5. If other error: Fallback to `/dashboard`

## Loading Components

### LoadingPage

**File:** `../components/common/LoadingPage.tsx`

A full-page loading component with Rendasua branding and animations.

```typescript
import { LoadingPage } from '../hooks';

<LoadingPage 
  message="Loading Rendasua"
  subtitle="Please wait while we prepare your experience"
  showProgress={true}
/>
```

### LoadingSpinner

**File:** `../components/common/LoadingSpinner.tsx`

A compact loading spinner for smaller loading states.

```typescript
import { LoadingSpinner } from '../hooks';

<LoadingSpinner 
  message="Loading data..."
  size="medium"
  fullHeight={false}
/>
```

## Usage Examples

### Complete Login Flow Implementation

```typescript
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useLoginFlow, LoadingPage } from '../hooks';
import Dashboard from './Dashboard';
import CompleteProfile from './CompleteProfile';

function App() {
  const { isCheckingProfile, isLoading } = useLoginFlow();

  if (isLoading || isCheckingProfile) {
    return (
      <LoadingPage 
        message={isCheckingProfile ? "Checking Profile" : "Loading Rendasua"}
        subtitle={isCheckingProfile ? "Verifying your account information" : "Please wait while we authenticate your session"}
        showProgress={true}
      />
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
    </Routes>
  );
}
```

### API Request with Error Handling

```typescript
import React, { useState, useEffect } from 'react';
import { useApiClient } from '../hooks';

const UserProfile = () => {
  const apiClient = useApiClient();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await apiClient.get('/users/me');
        setUserData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [apiClient]);

  if (loading) return <LoadingSpinner message="Loading profile..." />;
  if (error) return <div>Error: {error}</div>;

  return <div>Welcome, {userData.user.first_name}!</div>;
};
```

## Environment Setup

Make sure to set up the following environment variables in your `.env` file:

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=your-audience
``` 