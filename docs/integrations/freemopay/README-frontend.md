# Freemopay (Payments – Cameroon) (Frontend)

## What Freemopay is

Freemopay is a payments provider used for **mobile money payments in Cameroon**.

## What we use it for

- Taking customer payments at checkout (mobile money)
- Checking payment status after the customer approves

## Does the frontend talk to Freemopay directly?

No. The frontend calls **our backend** payment endpoints. The backend integrates with Freemopay.

Frontend entry point in this repo:

- `apps/frontend/src/hooks/useMobilePayments.ts` (calls backend routes like `/mobile-payments/initiate`)

## Configuration required (Frontend)

None specific to Freemopay.

