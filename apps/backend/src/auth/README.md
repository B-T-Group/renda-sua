# Authentication Implementation

This directory contains the authentication implementation for the Rendasua backend API using Auth0.

## Components

### AuthGuard (`auth.guard.ts`)

- **Purpose**: Verifies Auth0 access tokens on all protected API endpoints
- **Features**:
  - Validates JWT tokens using Auth0's JWKS endpoint
  - Caches JWKS keys for performance
  - Supports public routes (no authentication required)
  - Extracts user information from tokens
  - Handles token expiration and validation errors

### CurrentUser Decorator (`user.decorator.ts`)

- **Purpose**: Extracts user information from the request object
- **Usage**: `@CurrentUser() auth0User: any`
- **Returns**: The decoded JWT payload containing user information

### Public Decorator (`public.decorator.ts`)

- **Purpose**: Marks routes as public (no authentication required)
- **Usage**: `@Public()`
- **Example**: Health check endpoints, public APIs

### AuthModule (`auth.module.ts`)

- **Purpose**: Organizes authentication components
- **Features**: Provides AuthGuard as a global guard

## Configuration

The AuthGuard requires the following environment variables:

```env
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience
```

## Usage Examples

### Protected Route with User Information

```typescript
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/user.decorator';

@Controller('users')
export class UsersController {
  @Get('me')
  async getCurrentUser(@CurrentUser() auth0User: any) {
    return {
      sub: auth0User.sub,
      email: auth0User.email,
      email_verified: auth0User.email_verified,
    };
  }
}
```

### Public Route

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
```

### Route with Custom Authentication Logic

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

@Controller('admin')
@UseGuards(AuthGuard) // Apply to specific controller
export class AdminController {
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any) {
    // Custom admin logic here
    return { message: 'Admin dashboard' };
  }
}
```

## Token Validation Process

1. **Extract Token**: Gets Bearer token from Authorization header
2. **Check Public Route**: Skips validation if route is marked as public
3. **Validate JWT**: Verifies token signature using Auth0 JWKS
4. **Check Claims**: Validates audience and issuer claims
5. **Extract User**: Adds decoded payload to request object
6. **Handle Errors**: Returns 401 for invalid/expired tokens

## Error Handling

- **No Token**: Returns 401 Unauthorized
- **Invalid Token**: Returns 401 Unauthorized
- **Expired Token**: Returns 401 Unauthorized
- **Missing Configuration**: Throws error during startup

## Security Features

- **JWKS Caching**: Reduces API calls to Auth0
- **Token Validation**: Full JWT validation with RS256 algorithm
- **Audience Validation**: Ensures tokens are for the correct API
- **Issuer Validation**: Verifies tokens come from Auth0
- **Public Route Support**: Allows unauthenticated access where needed

## Frontend Integration

The frontend implements automatic token refresh:

- **Automatic Refresh**: Attempts to refresh expired tokens
- **Retry Logic**: Retries failed requests with new tokens
- **Login Redirect**: Redirects to login if refresh fails
- **Error Handling**: Graceful handling of authentication errors

## Testing

To test the authentication:

1. **Public Routes**: Should work without authentication
2. **Protected Routes**: Should require valid Auth0 token
3. **Invalid Tokens**: Should return 401 Unauthorized
4. **Expired Tokens**: Should trigger token refresh in frontend

## Environment Setup

Ensure your Auth0 application is configured with:

- **Application Type**: Single Page Application (SPA)
- **Allowed Callback URLs**: Your frontend URLs
- **Allowed Web Origins**: Your frontend domain
- **API Audience**: Your backend API identifier
- **Token Endpoint Authentication Method**: None (for SPA)
