# Auth0 (Backend)

## What Auth0 is

Auth0 is our identity provider. The backend uses it to **verify** that requests are coming from authenticated users by validating Auth0-issued access tokens.

## What we use it for

- Verifying JWT access tokens on protected endpoints
- Reading user identity fields from the token (e.g., `sub`, email)
- (Optional) calling Auth0 Management APIs for account-related operations

## How it’s used in the backend

- The backend validates tokens using Auth0’s public keys (JWKS).
- Most endpoints require a valid token unless explicitly marked public.
- The JWT contains Hasura-related claims used for role/persona behavior (see `docs/auth0-active-persona-jwt.md`).

Existing technical doc: `apps/backend/src/auth/README.md`

## Configuration required (Backend)

Minimum required:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`

Optional (used only when the backend needs to call Auth0 APIs directly):

- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_MGMT_CLIENT_ID`
- `AUTH0_MGMT_CLIENT_SECRET`

## What can break

- Backend rejects requests with 401 if:
  - Auth0 domain/audience is wrong
  - Auth0 tenant/API configuration changed
  - Tokens are issued for a different audience than the backend expects

