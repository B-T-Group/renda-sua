# Auth0 JWT Claims Setup for Hasura

## Overview

This document explains how to configure Auth0 Actions to properly set JWT claims for Hasura integration, specifically the `x-hasura-user-id` claim.

## The Problem

When users authenticate via Auth0 (passwordless OTP), Auth0 creates JWT tokens with custom claims. The backend expects `x-hasura-user-id` to be the **database user UUID** (format: `550e8400-e29b-41d4-a716-446655440000`), not the Auth0 subject identifier (format: `auth0|1234567890` or `email|abc123`).

### Common Error

```
Invalid authentication token: user id is not a UUID (Auth0 sub detected: auth0|...).
Auth0 Action must look up the database user UUID, not use the Auth0 sub.
```

This error occurs when:
1. A new user signs up via phone/email OTP
2. The Auth0 Action tries to set JWT claims
3. The Action uses the Auth0 `sub` instead of looking up the database UUID
4. The backend rejects the token because Auth0 `sub` is not a valid UUID

## Solution: Auth0 Action Configuration

### Required Auth0 Action

Create an Auth0 **Post-Login Action** (or Credentials Exchange for M2M) that:

1. Extracts the user's email or phone number from the Auth0 user profile
2. Calls the Rendasua backend to resolve the database UUID
3. Sets the JWT claims with the correct UUID

### Action Code Example

```javascript
/**
 * Auth0 Post-Login / Credentials Exchange Action for Hasura JWT Claims
 * 
 * This action runs after authentication and token refresh to set custom JWT claims
 * that Hasura uses for authorization.
 * 
 * IMPORTANT: Must be configured for BOTH:
 * - Post-Login flow (authentication)
 * - Credentials Exchange flow (token refresh)
 */

exports.onExecutePostLogin = async (event, api) => {
  await setHasuraClaimsFromMetadata(event, api);
};

exports.onExecuteCredentialsExchange = async (event, api) => {
  await setHasuraClaimsFromMetadata(event, api);
};

async function setHasuraClaimsFromMetadata(event, api) {
  const namespace = 'https://hasura.io/jwt/claims';
  
  // Read Rendasua user data from app_metadata (set by backend after signup)
  const userId = event.user.app_metadata?.rendasua_user_id;
  const defaultRole = event.user.app_metadata?.rendasua_default_role || 'user';
  const allowedRoles = event.user.app_metadata?.rendasua_allowed_roles || ['user'];
  
  if (!userId) {
    console.log('No rendasua_user_id in app_metadata for user', event.user.user_id);
    
    // For returning users who signed up before metadata was set, look up via API
    const email = event.user.email;
    const phoneNumber = event.user.phone_number;
    
    if (email || phoneNumber) {
      try {
        const response = await fetch(
          `${event.secrets.BACKEND_URL}/api/auth0-actions/resolve-user-id`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth0-Action-Secret': event.secrets.AUTH0_ACTION_SECRET,
            },
            body: JSON.stringify(
              email ? { email } : { phone_number: phoneNumber }
            ),
          }
        );
        
        const data = await response.json();
        
        if (data.found && data.user_id) {
          console.log('Resolved user via API for migration');
          const claims = {
            'x-hasura-user-id': data.user_id,
            'x-hasura-default-role': defaultRole,
            'x-hasura-allowed-roles': allowedRoles,
          };
          api.accessToken.setCustomClaim(namespace, claims);
          api.idToken.setCustomClaim(namespace, claims);
          return;
        }
      } catch (error) {
        console.error('Failed to resolve user ID via API:', error.message);
      }
    }
    
    // New signup - backend will set metadata and refresh token
    console.log('New signup - skipping claims (backend will set metadata)');
    return;
  }
  
  // Set Hasura JWT claims from app_metadata
  const claims = {
    'x-hasura-user-id': userId,
    'x-hasura-default-role': defaultRole,
    'x-hasura-allowed-roles': allowedRoles,
  };
  
  api.accessToken.setCustomClaim(namespace, claims);
  api.idToken.setCustomClaim(namespace, claims);
}
```

### Required Auth0 Secrets

Configure these secrets in your Auth0 Action:

- `BACKEND_URL`: Your Rendasua backend URL (e.g., `https://api.rendasua.com`)
- `AUTH0_ACTION_SECRET`: Shared secret for authenticating API calls (matches backend `AUTH0_ACTIONS_SHARED_SECRET`)

## How New Signup Gets Proper UUID Claims

### The Challenge

During signup, Auth0 creates JWT tokens **before** the user exists in the database, so the Auth0 Action cannot look up the UUID.

### The Solution

The backend sets Auth0 `app_metadata` after creating the user, then refreshes the tokens:

```
New Signup Flow:
1. User submits phone/email for signup
2. Auth0 sends OTP
3. User verifies OTP
4. Auth0 generates initial JWT tokens
   └─> Auth0 Action runs (no app_metadata yet)
   └─> Action skips setting claims (user doesn't exist)
5. Backend receives tokens
6. Backend creates user in database with UUID
7. ✅ Backend sets Auth0 app_metadata:
   └─> rendasua_user_id: <uuid>
   └─> rendasua_default_role: 'client'/'agent'/'business'
   └─> rendasua_allowed_roles: ['user', 'client', ...]
8. ✅ Backend refreshes tokens using refresh_token
   └─> Auth0 Action runs again (Credentials Exchange)
   └─> Action reads app_metadata and sets proper claims
9. Backend returns refreshed tokens to client
10. Client uses tokens with proper x-hasura-user-id UUID ✅
```

### Login Flow

For returning users, `app_metadata` already exists:

1. User submits email/phone for login
2. Auth0 sends OTP
3. User verifies OTP
4. Auth0 generates JWT tokens (Auth0 Action runs)
5. Action reads `app_metadata.rendasua_user_id`
6. Action sets proper JWT claims immediately
7. Tokens work on first try ✅

### Migration: Existing Users

For users who signed up before `app_metadata` was implemented:

- Auth0 Action calls `/api/auth0-actions/resolve-user-id` (fallback)
- Looks up user by email/phone
- Sets claims from lookup result
- (Optional) Backend can backfill `app_metadata` for all users)

## Testing

### Test the resolve-user-id endpoint (Auth0 Action helper)

```bash
# Test with shared secret header
curl -X POST https://api.rendasua.com/api/auth0-actions/resolve-user-id \
  -H "Content-Type: application/json" \
  -H "X-Auth0-Action-Secret: your-secret-here" \
  -d '{"email": "test@example.com"}'

# Expected response for existing user:
# {"user_id": "550e8400-e29b-41d4-a716-446655440000", "found": true}

# Expected response for new user:
# {"user_id": null, "found": false}

# Without secret header - should get 401:
curl -X POST https://api.rendasua.com/api/auth0-actions/resolve-user-id \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
# Expected: {"statusCode": 401, "message": "Invalid or missing action secret"}
```

### Verify JWT Claims

After authentication, decode the JWT access token and verify:

```json
{
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440000",
    "x-hasura-default-role": "client",
    "x-hasura-allowed-roles": ["user", "client"]
  }
}
```

The `x-hasura-user-id` **must** be a valid UUID, not an Auth0 sub.

## Troubleshooting

### Error: "user id is not a UUID (Auth0 sub detected)"

**Cause:** Auth0 Action is using Auth0 `sub` instead of database UUID.

**Fix:** Update your Auth0 Action to call `/api/auth0-actions/resolve-user-id` and use the returned UUID.

### Error: "User not found" during login

**Cause:** User hasn't completed signup yet.

**Fix:** Ensure user completes the signup flow first before attempting login.

### JWT claims missing

**Cause:** Auth0 Action may not be deployed or may have errors.

**Fix:**
1. Check Auth0 Action is deployed and enabled
2. Review Action logs in Auth0 dashboard
3. Verify all required secrets are configured

## Related Documentation

- See `docs/auth0-active-persona-jwt.md` for persona handling
- See `docs/integrations/auth0/README-backend.md` for general Auth0 integration
- See `apps/backend/src/auth/README.md` for authentication architecture

## Migration Notes

### Previous Implementation (Deprecated)

Previously, the system used a `users.identifier` column that stored the Auth0 `sub`. The Auth0 Action would:
1. Look up user by `identifier = sub`
2. Return the user's `id` (UUID)
3. Set `x-hasura-user-id` to that UUID

This column was removed in migration `20260327120000_drop_users_identifier` because:
- It created redundant data
- Auth0 `sub` can be derived from email/phone
- Simplified the user model

The new implementation uses email/phone lookup instead, which works better with the passwordless OTP flow.
