# Integrations (non-technical guide)

This document explains the **external services (integrations)** Rendasua uses, **what they are for**, and **what needs to be configured** so they work.

If you are non-technical: you can use this doc to understand **why we pay for each service**, **what could break**, and **what information we need** when setting up a new environment (dev/staging/prod).

## How to read this

- **Frontend** = the web app users interact with (browser).
- **Backend** = the API server and background jobs (where secrets live).
- **Configuration** = values we set as environment variables (API keys, URLs, etc.). These are typically stored in a secrets manager in production.

## Quick map of integrations

| Integration | What it’s used for | Where it runs |
|---|---|---|
| **Auth0** | Login, identity, issuing access tokens (JWT) | Frontend + Backend |
| **Resend** | Sending transactional emails (order updates, etc.) | Backend |
| **MyPVit (Gabon payments)** | Mobile money/card payment initiation + callbacks | Backend (Frontend calls backend endpoints) |
| **Freemopay (Cameroon payments)** | Mobile money payment initiation + callbacks | Backend (Frontend calls backend endpoints) |
| **MTN & Orange SMS** | Sending SMS notifications (order updates) | Backend |
| **Twilio** | Reserved/optional SMS provider (configured in backend, not actively used today) | Backend (not active) |
| **AWS** | Infrastructure + S3 uploads + secrets in CI/CD | Backend + Infrastructure |

## What needs configuration (high level)

Every integration needs some combination of:

- **Account setup**: an account with the provider + enabled products (email, SMS, payments, etc.)
- **API credentials**: API keys / client IDs / client secrets (stored as secrets)
- **Allowed URLs**: callback URLs / redirect URLs / webhook URLs (varies per provider)
- **Environment-specific values**: dev vs staging vs prod (different credentials and base URLs)

## Integration pages

- Auth0
  - Frontend: `docs/integrations/auth0/README-frontend.md`
  - Backend: `docs/integrations/auth0/README-backend.md`
- Resend
  - Frontend: `docs/integrations/resend/README-frontend.md`
  - Backend: `docs/integrations/resend/README-backend.md`
- MyPVit (Payments – Gabon)
  - Frontend: `docs/integrations/mypvit/README-frontend.md`
  - Backend: `docs/integrations/mypvit/README-backend.md`
- Freemopay (Payments – Cameroon)
  - Frontend: `docs/integrations/freemopay/README-frontend.md`
  - Backend: `docs/integrations/freemopay/README-backend.md`
- MTN & Orange SMS
  - Frontend: `docs/integrations/sms/README-frontend.md`
  - Backend: `docs/integrations/sms/README-backend.md`
- Twilio
  - Frontend: `docs/integrations/twilio/README-frontend.md`
  - Backend: `docs/integrations/twilio/README-backend.md`
- AWS
  - Frontend: `docs/integrations/aws/README-frontend.md`
  - Backend: `docs/integrations/aws/README-backend.md`

