# Auth0 + Hasura: active persona in the JWT

Personas (client / agent / business) live in **Hasura**, not in Auth0 `app_metadata`. The SPA sends a **custom authorization parameter** on silent refresh so each access token’s Hasura claims match the UI’s active mode.

## SPA contract

- After login or when the user switches persona, call:

  `getAccessTokenSilently({ cacheMode: 'off', authorizationParams: { active_persona: 'client' | 'agent' | 'business' } })`

- Authenticated Nest calls should send header **`X-Active-Persona`** with the same value (the app already aligns this with stored choice + JWT `x-hasura-user-id`). Nest prefers this header when it matches an enrolled persona and a JWT allowed role, so a stale `x-hasura-default-role` after a UI persona switch does not block client actions like creating orders.

- **Auth0 application**: allow the custom parameter used on `/authorize` (and on the refresh path your tenant uses—confirm in Auth0 docs for your SDK version).

## Action responsibilities (Post-Login / refresh hook)

Implement in the Auth0 tenant (not in this repo):

1. Resolve the Auth0 user (`sub` / email) and query **Hasura with the admin secret** (or a dedicated secure endpoint) for that user’s rows: `users` + optional `clients`, `agents`, `businesses` by `user_id`.
2. Build **`x-hasura-allowed-roles`** from which profile rows exist (e.g. include `client`, `agent`, `business` only when the row exists). **Always include `user`** in this array (additive). Nest JWT validation and Hasura already know the `user` role; location delegates may have no persona rows.
3. Read **`active_persona`** from the authorization request (the param forwarded from `authorizationParams`). Normalize to lowercase.
4. If `active_persona` is missing and the user has **exactly one** persona, use that role as default. If **multiple** personas and param missing/invalid, choose a safe fallback (e.g. first stable order) or deny—match product rules.
5. If the user has **no persona rows** (delegate-only identity, `user_types.id = user`), set **`x-hasura-default-role = user`**. Persona users keep today’s default role (`client` / `agent` / `business`).
6. Set custom claim `https://hasura.io/jwt/claims` with:
   - `x-hasura-default-role` = validated `active_persona`, or `user` when there is no persona
   - `x-hasura-allowed-roles` = array from step 2 (always includes `user`)
   - `x-hasura-user-id` = internal user UUID (existing pattern)

## Silent refresh

If **Post-Login** does not run on refresh, add the hook Auth0 documents for your flow (e.g. **Credentials Exchange** or the current equivalent) so `active_persona` still reaches claim customization.

When the UI is in **delegation mode**, silent refresh should pass **no `active_persona`**. The Action must then set **`x-hasura-default-role = user`** (do not invent a fourth persona). Nest still identifies the user via `x-hasura-user-id`; `/api/delegate/*` uses **`X-Active-Delegation`**, not a Hasura `business` role.

The `location_delegations` feature flag is on in production. The Auth0 Action must include `user` in `x-hasura-allowed-roles` (and use `user` as default when there is no persona) so location delegates can authenticate.

## No `app_metadata` for personas

Do not store persona list or active persona in Auth0 `app_metadata` for this design; Hasura remains the source of truth.
