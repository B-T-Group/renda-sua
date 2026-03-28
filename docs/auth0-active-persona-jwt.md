# Auth0 + Hasura: active persona in the JWT

Personas (client / agent / business) live in **Hasura**, not in Auth0 `app_metadata`. The SPA sends a **custom authorization parameter** on silent refresh so each access token’s Hasura claims match the UI’s active mode.

## SPA contract

- After login or when the user switches persona, call:

  `getAccessTokenSilently({ cacheMode: 'off', authorizationParams: { active_persona: 'client' | 'agent' | 'business' } })`

- Authenticated Nest calls should send header **`X-Active-Persona`** with the same value (the app already aligns this with stored choice + JWT `x-hasura-user-id`).

- **Auth0 application**: allow the custom parameter used on `/authorize` (and on the refresh path your tenant uses—confirm in Auth0 docs for your SDK version).

## Action responsibilities (Post-Login / refresh hook)

Implement in the Auth0 tenant (not in this repo):

1. Resolve the Auth0 user (`sub` / email) and query **Hasura with the admin secret** (or a dedicated secure endpoint) for that user’s rows: `users` + optional `clients`, `agents`, `businesses` by `user_id`.
2. Build **`x-hasura-allowed-roles`** from which profile rows exist (e.g. include `client`, `agent`, `business` only when the row exists).
3. Read **`active_persona`** from the authorization request (the param forwarded from `authorizationParams`). Normalize to lowercase.
4. If `active_persona` is missing and the user has **exactly one** persona, use that role as default. If **multiple** personas and param missing/invalid, choose a safe fallback (e.g. first stable order) or deny—match product rules.
5. Set custom claim `https://hasura.io/jwt/claims` with:
   - `x-hasura-default-role` = validated `active_persona`
   - `x-hasura-allowed-roles` = array from step 2
   - `x-hasura-user-id` = internal user UUID (existing pattern)

## Silent refresh

If **Post-Login** does not run on refresh, add the hook Auth0 documents for your flow (e.g. **Credentials Exchange** or the current equivalent) so `active_persona` still reaches claim customization.

## No `app_metadata` for personas

Do not store persona list or active persona in Auth0 `app_metadata` for this design; Hasura remains the source of truth.
