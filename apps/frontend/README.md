# Rendasua Frontend

A React frontend application with Auth0 integration, Material-UI, and dual API client setup for backend and Hasura GraphQL.

## Features

- 🔐 **Auth0 Universal Login & Signup** - Secure authentication with Auth0
- 🎨 **Material-UI** - Modern, responsive UI components
- 🔌 **Dual API Clients** - Separate clients for backend and Hasura
- 🛡️ **Protected Routes** - Route protection based on authentication
- 🔄 **Token Management** - Automatic token handling for API requests
- 📱 **Responsive Design** - Mobile-friendly interface

## Architecture

### Authentication Flow
1. User clicks login/signup → Auth0 Universal Login
2. User authenticates → Auth0 returns JWT token
3. Token stored in localStorage → Available to API clients
4. API clients automatically include token in requests

### API Clients
- **Backend Client** (`apiClient`) - REST API calls to NestJS backend
- **Hasura Client** (`hasuraClient`) - GraphQL queries to Hasura

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Auth0 Configuration

1. Create an Auth0 application at [auth0.com](https://auth0.com)
2. Configure the following settings:
   - **Application Type**: Single Page Application
   - **Allowed Callback URLs**: `http://localhost:4200`
   - **Allowed Logout URLs**: `http://localhost:4200`
   - **Allowed Web Origins**: `http://localhost:4200`

3. Create an API in Auth0:
   - **Identifier**: `https://your-api-identifier`
   - **Signing Algorithm**: RS256

### 3. Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Auth0 Configuration
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier

# API Configuration
REACT_APP_BACKEND_URL=http://localhost:3000
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
```

### 4. Start Development Server

```bash
npm start
```

## Project Structure

```
src/
├── components/
│   └── auth/
│       ├── LoginButton.tsx      # Auth0 login button
│       ├── LogoutButton.tsx     # Auth0 logout button
│       ├── ProtectedRoute.tsx   # Route protection
│       └── UserProfile.tsx      # User profile display
├── config/
│   ├── auth0.config.ts          # Auth0 configuration
│   └── api.config.ts            # API endpoints
├── contexts/
│   └── Auth0Context.tsx         # Auth0 context provider
├── pages/
│   ├── LoginPage.tsx            # Login/signup page
│   └── DashboardPage.tsx        # Main dashboard
├── services/
│   ├── apiClient.ts             # Backend API client
│   └── hasuraClient.ts          # Hasura GraphQL client
└── app/
    └── app.tsx                  # Main app component
```

## API Clients

### Backend API Client

The `apiClient` handles REST API calls to the NestJS backend:

```typescript
import { apiClient } from '../services/apiClient';

// Get user types
const userTypes = await apiClient.getUserTypes();

// Get current user
const currentUser = await apiClient.getCurrentUser();

// Create user
const newUser = await apiClient.createUser(userData);
```

**Features:**
- Automatic token inclusion in requests
- Error handling and retry logic
- TypeScript support
- Response interceptors

### Hasura GraphQL Client

The `hasuraClient` handles GraphQL queries to Hasura:

```typescript
import { hasuraClient } from '../services/hasuraClient';

// Query users
const result = await hasuraClient.getUsers();

// Query with variables
const user = await hasuraClient.getUserByIdentifier('user123');

// Custom GraphQL query
const response = await hasuraClient.query({
  query: `
    query GetData {
      users {
        id
        email
      }
    }
  `
});
```

**Features:**
- GraphQL query/mutation support
- Variable handling
- Error handling
- TypeScript interfaces

## Authentication Components

### LoginButton
Universal login button that triggers Auth0's login flow:

```typescript
import { LoginButton } from '../components/auth/LoginButton';

<LoginButton variant="contained" size="large">
  Sign In
</LoginButton>
```

### LogoutButton
Logout button that clears tokens and redirects:

```typescript
import { LogoutButton } from '../components/auth/LogoutButton';

<LogoutButton variant="outlined">
  Sign Out
</LogoutButton>
```

### ProtectedRoute
Route wrapper that requires authentication:

```typescript
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### UserProfile
Displays authenticated user information:

```typescript
import { UserProfile } from '../components/auth/UserProfile';

<UserProfile />
```

## Pages

### LoginPage (`/login`)
- Auth0 universal login/signup
- Redirects to dashboard if already authenticated
- Clean, modern design

### DashboardPage (`/dashboard`)
- Protected route requiring authentication
- Demonstrates API client usage
- Shows user types, vehicle types, and current user data
- Real-time data fetching with loading states

## Token Management

The Auth0 context automatically manages JWT tokens:

1. **Token Storage**: Tokens stored in localStorage as `auth0_token`
2. **Automatic Inclusion**: API clients automatically include tokens in requests
3. **Token Refresh**: Auth0 handles token refresh automatically
4. **Logout Cleanup**: Tokens cleared on logout

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_AUTH0_DOMAIN` | Auth0 domain | `your-domain.auth0.com` |
| `REACT_APP_AUTH0_CLIENT_ID` | Auth0 client ID | `your-client-id` |
| `REACT_APP_AUTH0_AUDIENCE` | API identifier | `https://your-api-identifier` |
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:3000` |
| `REACT_APP_HASURA_URL` | Hasura GraphQL URL | `http://localhost:8080/v1/graphql` |

## Development

### Available Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run lint       # Run linter
```

### Adding New API Endpoints

1. **Backend API**: Add methods to `apiClient.ts`
2. **Hasura GraphQL**: Add methods to `hasuraClient.ts`
3. **Types**: Define TypeScript interfaces for responses

### Adding New Protected Routes

```typescript
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

<Route
  path="/protected"
  element={
    <ProtectedRoute>
      <YourComponent />
    </ProtectedRoute>
  }
/>
```

## Troubleshooting

### Common Issues

1. **Auth0 Configuration Errors**
   - Verify domain and client ID in `.env`
   - Check Auth0 application settings
   - Ensure callback URLs are correct

2. **API Connection Errors**
   - Verify backend and Hasura are running
   - Check API URLs in `.env`
   - Ensure CORS is configured

3. **Token Issues**
   - Clear localStorage and re-authenticate
   - Check Auth0 API configuration
   - Verify audience matches backend

### Debug Mode

Enable debug logging by adding to `.env`:

```bash
REACT_APP_DEBUG=true
```

## Security Considerations

- JWT tokens stored in localStorage (consider httpOnly cookies for production)
- Automatic token refresh handled by Auth0
- Protected routes prevent unauthorized access
- API clients include tokens automatically
- Logout clears all stored tokens

## Production Deployment

1. Update environment variables for production
2. Configure Auth0 for production domain
3. Set up proper CORS settings
4. Use HTTPS in production
5. Consider using httpOnly cookies for token storage 