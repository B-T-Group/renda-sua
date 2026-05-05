# Auth0 (Frontend)

## What Auth0 is

Auth0 is the service that handles **sign-in** for Rendasua and issues **access tokens** that prove a user is logged in.

## What we use it for

- **User login/logout** in the browser
- Getting an **access token (JWT)** used to call our backend API
- Supporting different “modes/personas” (client / agent / business) that influence permissions

## How it’s used in the app

- The frontend uses the Auth0 React SDK (`@auth0/auth0-react`).
- After login (or when switching persona), the app requests a fresh token and includes a custom parameter called `active_persona`.

Related doc: `docs/auth0-active-persona-jwt.md`

## Configuration required (Frontend)

These values are read from frontend environment variables:

- `REACT_APP_AUTH0_DOMAIN`
- `REACT_APP_AUTH0_CLIENT_ID`
- `REACT_APP_AUTH0_AUDIENCE`

Also required for the app to work:

- `REACT_APP_API_URL` (where the frontend sends API requests)
- `REACT_APP_GOOGLE_MAPS_API_KEY` (maps UI features)

## Auth0 dashboard setup (non-technical checklist)

- **Application type**: SPA (Single Page Application)
- **Allowed Callback URLs**: the frontend URL(s) (dev/staging/prod)
- **Allowed Logout URLs**: the frontend URL(s)
- **Allowed Web Origins**: the frontend URL(s)
- **API / Audience**: ensure the Auth0 “API” exists and matches `REACT_APP_AUTH0_AUDIENCE`

## What can break

- Users can’t log in (misconfigured callback/origin URLs or wrong domain/client id)
- Backend calls fail with 401 (wrong audience or token not being accepted)

