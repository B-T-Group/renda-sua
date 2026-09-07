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
 * Auth0 Post-Login Action for Hasura JWT Claims
 * 
 * This action runs after successful authentication and sets custom JWT claims
 * that Hasura uses for authorization.
 */

exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://hasura.io/jwt/claims';
  
  // Get user's email or phone from Auth0 profile
  const email = event.user.email;
  const phoneNumber = event.user.phone_number;
  
  if (!email && !phoneNumber) {
    console.log('No email or phone number found for user', event.user.user_id);
    return api.access.deny('User must have email or phone number');
  }
  
  // Look up the database user UUID
  let userId = null;
  try {
    const response = await fetch(`${event.secrets.BACKEND_URL}/api/auth0-actions/resolve-user-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        email ? { email } : { phone_number: phoneNumber }
      ),
    });
    
    const data = await response.json();
    
    if (data.found && data.user_id) {
      userId = data.user_id;
      console.log(`Resolved user ${userId} for ${email || phoneNumber}`);
    } else {
      console.log(`User not found in database for ${email || phoneNumber} (likely new signup)`);
      // For new signups, the user will be created after OTP verification
      // Skip setting claims for now - the signup flow handles this
      return;
    }
  } catch (error) {
    console.error('Failed to resolve user ID:', error.message);
    // Continue without claims - signup flow will handle new users
    return;
  }
  
  // Query Hasura to get user's personas (client, agent, business)
  // This determines which roles the user can assume
  const personas = await getUserPersonas(userId, event.secrets);
  
  // Set Hasura JWT claims
  const claims = {
    'x-hasura-user-id': userId,
    'x-hasura-default-role': personas.defaultRole || 'user',
    'x-hasura-allowed-roles': personas.allowedRoles || ['user'],
  };
  
  api.accessToken.setCustomClaim(namespace, claims);
  api.idToken.setCustomClaim(namespace, claims);
};

async function getUserPersonas(userId, secrets) {
  // Query Hasura to get user's personas
  const query = `
    query GetUserPersonas($userId: uuid!) {
      users_by_pk(id: $userId) {
        user_type_id
        client { id }
        agent { id }
        business { id }
      }
    }
  `;
  
  try {
    const response = await fetch(`${secrets.HASURA_URL}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': secrets.HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({ query, variables: { userId } }),
    });
    
    const result = await response.json();
    const user = result.data?.users_by_pk;
    
    if (!user) {
      return { defaultRole: 'user', allowedRoles: ['user'] };
    }
    
    // Build allowed roles based on which persona rows exist
    const allowedRoles = ['user']; // Always include 'user' role
    if (user.client?.id) allowedRoles.push('client');
    if (user.agent?.id) allowedRoles.push('agent');
    if (user.business?.id) allowedRoles.push('business');
    
    // Determine default role
    let defaultRole = 'user';
    if (user.user_type_id === 'client' && user.client?.id) defaultRole = 'client';
    else if (user.user_type_id === 'agent' && user.agent?.id) defaultRole = 'agent';
    else if (user.user_type_id === 'business' && user.business?.id) defaultRole = 'business';
    
    return { defaultRole, allowedRoles };
  } catch (error) {
    console.error('Failed to get user personas:', error.message);
    return { defaultRole: 'user', allowedRoles: ['user'] };
  }
}
```

### Required Auth0 Secrets

Configure these secrets in your Auth0 Action:

- `BACKEND_URL`: Your Rendasua backend URL (e.g., `https://api.rendasua.com`)
- `HASURA_URL`: Your Hasura GraphQL endpoint (e.g., `https://hasura.rendasua.com`)
- `HASURA_ADMIN_SECRET`: Hasura admin secret for querying user personas

## Signup Flow Timing

### Important: User Creation Happens After Token Generation

During the signup flow:

1. User submits phone/email for signup
2. Auth0 sends OTP
3. User verifies OTP
4. **Auth0 generates JWT tokens** (Auth0 Action runs here)
5. Backend receives tokens and **creates user in database**

This means:
- For **new signups**, the user doesn't exist when the Auth0 Action runs
- The Action should gracefully handle this by returning early
- The backend signup flow creates the user with a proper UUID
- On subsequent logins, the user exists and the Action can set proper claims

### Login Flow

For returning users:

1. User submits email/phone for login
2. Backend verifies user exists (returns 404 if not)
3. Auth0 sends OTP
4. User verifies OTP
5. Auth0 generates JWT tokens (Auth0 Action runs here)
6. Action successfully resolves user UUID
7. JWT claims are set correctly

## Testing

### Test with curl

```bash
# Test the resolve-user-id endpoint
curl -X POST https://api.rendasua.com/api/auth0-actions/resolve-user-id \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Expected response for existing user:
# {"user_id": "550e8400-e29b-41d4-a716-446655440000", "found": true}

# Expected response for new user:
# {"user_id": null, "found": false}
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
