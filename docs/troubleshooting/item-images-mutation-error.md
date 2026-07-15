# Troubleshooting: insert_item_images Mutation Not Found Error

## Error Message

```
field 'insert_item_images' not found in type: 'mutation_root'
```

## Root Cause

This error indicates that the authenticated user's JWT token does not have the correct Hasura role to access the `insert_item_images` mutation. Based on the Hasura metadata configuration, only users with the **`business`** role can insert into the `item_images` table.

## Why This Happens

### 1. JWT Role Mismatch
The user's JWT token must contain:
- `x-hasura-allowed-roles`: must include `"business"`
- `x-hasura-default-role`: should be set to `"business"` for business operations

### 2. Auth0 Action Not Setting Roles Correctly
According to `docs/auth0-active-persona-jwt.md`, the Auth0 Post-Login action should:
1. Query Hasura to find which persona rows exist for the user (client, agent, business)
2. Build `x-hasura-allowed-roles` based on which profiles exist
3. Set `x-hasura-default-role` based on the `active_persona` parameter

If the business profile doesn't exist in the database, or the Auth0 action isn't querying correctly, the JWT won't have the business role.

### 3. Missing Business Profile
The user might not have a corresponding row in the `businesses` table linked to their `user_id`, which would prevent the Auth0 action from adding `business` to the allowed roles.

## Diagnostic Steps

### Step 1: Decode the JWT Token
Decode the JWT access token and check the Hasura claims:

```json
{
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "user-uuid-here",
    "x-hasura-default-role": "business",  // Should be "business"
    "x-hasura-allowed-roles": ["business", "user"]  // Should include "business"
  }
}
```

### Step 2: Verify Business Profile Exists
Check if the user has a business profile in the database:

```sql
SELECT id, user_id, name, is_verified 
FROM businesses 
WHERE user_id = 'user-uuid-from-jwt';
```

### Step 3: Check Active Persona
Ensure the frontend is sending the correct `active_persona` parameter when calling `getAccessTokenSilently()`:

```typescript
const token = await getAccessTokenSilently({
  cacheMode: 'off',
  authorizationParams: {
    active_persona: 'business'  // Must match the user's persona
  }
});
```

### Step 4: Verify Auth0 Action
The Auth0 Post-Login action should:
1. Query Hasura for the user's profiles
2. Build the allowed roles based on existing profiles
3. Set the default role based on the `active_persona` parameter

## Resolution Steps

### Option 1: Frontend Fix
Ensure the frontend application is requesting tokens with the correct `active_persona`:

```typescript
// When performing business operations
const token = await getAccessTokenSilently({
  cacheMode: 'off',
  authorizationParams: { active_persona: 'business' }
});

// Include X-Active-Persona header in API calls
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Active-Persona': 'business'
}
```

### Option 2: Backend Workaround (Use HasuraSystemService)
For backend operations that should always work regardless of the user's role, use `HasuraSystemService` instead of `HasuraUserService`:

```typescript
// Before (fails if user doesn't have business role)
await this.hasuraUserService.executeMutation(INSERT_ITEM_IMAGES, { objects });

// After (uses admin privileges)
await this.hasuraSystemService.executeMutation(INSERT_ITEM_IMAGES, { objects });
```

### Option 3: Fix Auth0 Action
Ensure the Auth0 Post-Login action is:
1. Properly configured to run on token refresh
2. Querying Hasura successfully
3. Setting the JWT claims correctly

## Related Files

- `/workspace/apps/hasura/metadata/databases/Rendasua/tables/public_item_images.yaml` - Hasura permissions
- `/workspace/apps/backend/src/business-images/business-images.service.ts` - Service using the mutation
- `/workspace/docs/auth0-active-persona-jwt.md` - Auth0 JWT configuration guide

## Prevention

1. Always ensure business users have a valid business profile row before allowing business operations
2. Frontend should check the user's available personas and only show business features if `business` persona exists
3. Backend endpoints should validate that the authenticated user has the required business profile before attempting business operations
