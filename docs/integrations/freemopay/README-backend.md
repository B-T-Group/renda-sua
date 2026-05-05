# Freemopay (Payments – Cameroon) (Backend)

## What Freemopay is

Freemopay is a payments provider used for **mobile money payments in Cameroon**.

## What we use it for

Through the backend “Mobile Payments” module, we use Freemopay to:

- Initiate payments
- Check payment status
- Receive and process callbacks/webhooks

Related technical doc (shared payments module):

- `apps/backend/src/mobile-payments/README.md`

## Configuration required (Backend)

- `FREEMOPAY_BASE_URL` (defaults in code exist)
- `FREEMOPAY_APP_KEY`
- `FREEMOPAY_SECRET_KEY`
- `FREEMOPAY_CALLBACK_URL` (public URL Freemopay will call for payment status updates)

## What else is needed outside code

- A Freemopay merchant account and the right payment products enabled
- The callback/webhook URL configured in Freemopay’s dashboard

## What can break

- Payments won’t work if `FREEMOPAY_SECRET_KEY` is missing/invalid
- Callbacks fail if `FREEMOPAY_CALLBACK_URL` is not publicly reachable (or misconfigured)

