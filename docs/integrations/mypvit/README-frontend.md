# MyPVit (Payments – Gabon) (Frontend)

## What MyPVit is

MyPVit is a payments provider used for **mobile money and card payments** in markets like Gabon.

## What we use it for

- Taking customer payments at checkout (mobile money / card)
- Checking payment status after the customer approves

## Does the frontend talk to MyPVit directly?

No. The frontend calls **our backend** payment endpoints. The backend integrates with MyPVit.

Frontend entry point in this repo:

- `apps/frontend/src/hooks/useMobilePayments.ts` (calls backend routes like `/mobile-payments/initiate`)

## Configuration required (Frontend)

None specific to MyPVit.

The frontend only needs to know where the backend API is:

- `REACT_APP_API_URL`

