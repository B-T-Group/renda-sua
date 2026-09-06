# Authentication Module

Handles user signup, login, and session management. The web in-app authentication flow replaces Auth0 Universal Login with a custom modal-based experience for desktop and full-page for mobile.

## Architecture

### Signup Flow

1. User submits email or phone number via `LoginMethodDialog`
2. Backend sends OTP via email (4 digits) or SMS
3. User enters OTP on `OtpAuthPage`
4. Backend verifies OTP with Auth0, provisions user if needed
5. For web: backend creates encrypted session, returns HttpOnly cookie
6. For mobile: backend returns tokens in JSON response

### Login Flow

1. User submits email or phone number via `LoginMethodDialog`
2. Backend sends OTP via email (4 digits) or SMS
3. User enters OTP on `OtpAuthPage`
4. Backend verifies OTP with Auth0
5. For web: backend creates encrypted session, returns HttpOnly cookie
6. For mobile: backend returns tokens in JSON response

### Session Management (Web Only)

- **Opaque session cookie**: Contains a randomly generated session ID (not a JWT)
- **Server-side encrypted storage**: Auth0 refresh tokens are encrypted with AES-256-GCM and stored in Redis (or in-memory for local dev). For local Redis: `yarn redis:up` and set `USE_LOCAL_REDIS=true` + `REDIS_HOST=localhost` in `.env.local` (not `.env.development` — that file is shared)
- **Memory-only access tokens**: Access tokens are never persisted in browser storage, only in memory
- **Silent refresh**: Frontend refreshes tokens via `/auth/login/refresh` using the session cookie
- **Session rotation**: Each refresh generates a new session ID and invalidates the old one
- **Reuse detection**: If a retired session cookie is used, the entire session family is invalidated

### Platform Detection

The backend distinguishes between web and mobile clients using the `X-Client-Platform` header:
- `web`: Returns session cookie, no `refresh_token` in JSON
- `mobile`: Returns full token response in JSON
- Unknown platforms default to `web` behavior (fail closed)

### Security Features

- **HttpOnly, Secure, SameSite=Lax cookies** for CSRF protection
- **`X-Requested-With: XMLHttpRequest`** header required for refresh/logout to prevent CSRF
- **Strict CORS** with explicit origin allowlist for credentialed requests
- **`returnTo` validation** on both frontend and backend to prevent open redirects
- **Login rate limiting**: Per-identifier lockout (5 attempts, 15-minute lockout) backed by Redis in production
- **Session family tracking**: Redis SETs track related sessions for invalidation on reuse
- **Encrypted Auth0 tokens**: AES-256-GCM encryption for refresh tokens stored server-side

## Required Environment Variables

### SESSION_ENCRYPTION_KEY

**REQUIRED in production.** Must be exactly **32 raw bytes** (not base64, not hex — raw binary 32-byte key).

Generate a secure key:
```bash
openssl rand -base64 32 | head -c 32
```

Add to AWS Secrets Manager (or your secrets store):
- **Development**: Can fall back to `JWT_SECRET` (auto-padded to 32 bytes)
- **Production**: Hard-required, no fallback, fails startup if missing or wrong length

The key encrypts Auth0 refresh tokens stored in Redis. Without it:
- Existing sessions cannot be decrypted
- Silent refresh will fail for all users
- Users will be logged out

### AUTH0_TEST_USERS_ENABLED

**Security**: Test user bypass is ONLY enabled when:
- Explicitly set to `'true'` via environment variable AND
- `NODE_ENV !== 'production'`

This prevents test users from being enabled in production even if `NODE_ENV` is misconfigured.

### AUTH0_TEST_USER_PASSWORD

**Security**: Must be set explicitly via environment variable. No hardcoded default in production.

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

### SessionStoreService (`session-store.service.ts`)

- **Purpose**: Manages encrypted server-side sessions for web clients
- **Features**:
  - Encrypts Auth0 refresh tokens with AES-256-GCM
  - Stores sessions in Redis (production) or in-memory (development)
  - Session rotation and reuse detection
  - Session family tracking for invalidation on reuse

### LockoutService (`lockout.service.ts`)

- **Purpose**: Per-identifier login attempt tracking and lockout
- **Features**:
  - 5 attempts per identifier
  - 15-minute lockout duration
  - Backed by Redis in production (multi-pod safe)
  - Falls back to in-memory in development

### LoginService (`login.service.ts`)

- **Purpose**: Handles login flow and OTP verification
- **Features**:
  - Email and phone OTP login
  - Platform-aware token delivery (cookie for web, JSON for mobile)
  - Lockout enforcement

### SignupService (`signup.service.ts`)

- **Purpose**: Handles signup flow and OTP verification
- **Features**:
  - Email and phone OTP signup
  - User provisioning with Auth0
  - Platform-aware token delivery
  - Replay-safe session reuse for completed signups

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

## Frontend Integration

### Session Hydration

On app load, the frontend makes a silent refresh call to `/auth/login/refresh` with its session cookie to obtain a fresh access token. This token is stored only in memory (React state).

### CSRF Protection

All state-changing requests (refresh, logout) must include the `X-Requested-With: XMLHttpRequest` header to prevent CSRF attacks.

### Platform Header

The frontend must set `X-Client-Platform: web` on all auth-related requests to ensure correct token delivery.

## Testing

To test the authentication:

1. **Public Routes**: Should work without authentication
2. **Protected Routes**: Should require valid Auth0 token
3. **Invalid Tokens**: Should return 401 Unauthorized
4. **Expired Tokens**: Should trigger token refresh in frontend
5. **Session Reuse**: Retired session cookies should invalidate the entire session family
6. **Login Lockout**: 5+ failed attempts should lock out for 15 minutes

## Environment Setup

Ensure your Auth0 application is configured with:

- **Application Type**: Single Page Application (SPA)
- **Allowed Callback URLs**: Your frontend URLs
- **Allowed Web Origins**: Your frontend domain
- **API Audience**: Your backend API identifier
- **Token Endpoint Authentication Method**: None (for SPA)
