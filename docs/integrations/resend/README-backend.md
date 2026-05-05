# Resend (Backend)

## What Resend is

Resend is our provider for **transactional email** (order confirmations, status changes, etc.).

## What we use it for

- Sending emails using **template IDs** stored in the codebase
- Supporting English/French templates
- Keeping email failures from breaking the main “order flow”

Existing technical docs:

- `apps/backend/src/notifications/README.md`
- `EMAIL_NOTIFICATION_SYSTEM_IMPLEMENTATION.md`

## Configuration required (Backend)

Required:

- `RESEND_API_KEY`

Optional (defaults exist in code):

- `RESEND_FROM_EMAIL` (defaults to `Rendasua <noreply@rendasua.com>`)
- `ORDER_STATUS_NOTIFICATIONS_ENABLED` (set to `false` to disable order-status emails)

## How templates are managed

- HTML sources live under `apps/backend/src/notifications/templates/{en,fr}`
- A script syncs templates to Resend and writes IDs locally:
  - `npm run sync:resend-templates`
- Runtime IDs are loaded from `apps/backend/src/notifications/resend-template-ids.json`

## What else is needed outside code

- Resend account with a verified sending domain (production)
- DNS records (SPF/DKIM) for deliverability

## What can break

- Emails stop sending if `RESEND_API_KEY` is missing/invalid
- Specific emails may be skipped if a template ID is missing from `resend-template-ids.json`

