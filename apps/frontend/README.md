# Frontend App with Auth0 Integration

This frontend app is configured with Auth0 Universal Login following the [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react/01-login).

## Setup Instructions

### 1. Configure Auth0

1. Go to your [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new Single Page Application (SPA)
3. Get your **Domain** and **Client ID** from the application settings

### 2. Environment Variables

Create a `.env` file in the `apps/frontend` directory with the following variables:

```bash
# Auth0 Configuration
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier

# Backend API Configuration
REACT_APP_BACKEND_URL=http://localhost:3000
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
```

### 3. Configure Auth0 Application Settings

In your Auth0 application settings, configure:

- **Allowed Callback URLs**: `http://localhost:4200`
- **Allowed Logout URLs**: `http://localhost:4200`
- **Allowed Web Origins**: `http://localhost:4200`

### 4. Start the Application

```bash
npm run start:frontend
```

## Features

- **Login/Logout**: Universal Login with Auth0
- **User Profile**: Display user information after authentication
- **Protected Routes**: Route protection for authenticated users
- **Loading States**: Proper loading states during authentication

## Components

- `LoginButton`: Initiates Auth0 Universal Login
- `LogoutButton`: Logs out the user
- `UserProfile`: Displays user profile information
- `ProtectedRoute`: Guards routes that require authentication

## Available Routes

- `/`: Home page (public)
- `/profile`: User profile page (protected)
- `/protected`: Protected content page (protected) 