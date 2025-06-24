# Quick Setup Guide

## 1. Auth0 Configuration

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new application:
   - **Name**: Rendasua Frontend
   - **Type**: Single Page Application
3. Configure settings:
   - **Allowed Callback URLs**: `http://localhost:4200`
   - **Allowed Logout URLs**: `http://localhost:4200`
   - **Allowed Web Origins**: `http://localhost:4200`
4. Create an API:
   - **Name**: Rendasua API
   - **Identifier**: `https://rendasua-api`
   - **Signing Algorithm**: RS256

## 2. Environment Setup

Copy `env.example` to `.env` and update with your Auth0 values:

```bash
cp env.example .env
```

Edit `.env`:
```bash
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=https://rendasua-api
REACT_APP_BACKEND_URL=http://localhost:3000
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
```

## 3. Start the Application

```bash
npm start
```

## 4. Test the Integration

1. Navigate to `http://localhost:4200`
2. Click "Sign In" → Should redirect to Auth0
3. Create account or sign in
4. Should redirect back to dashboard
5. Dashboard should show user profile and API data

## 5. Verify API Clients

The dashboard demonstrates:
- ✅ Auth0 authentication
- ✅ Backend API calls (user types, vehicle types, current user)
- ✅ Hasura GraphQL client (ready for use)
- ✅ Protected routes
- ✅ Token management

## Troubleshooting

- **Auth0 errors**: Check domain and client ID in `.env`
- **API errors**: Ensure backend and Hasura are running
- **CORS errors**: Check API URLs and CORS configuration 