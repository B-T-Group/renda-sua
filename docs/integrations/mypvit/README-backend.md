# MyPVit (Payments – Gabon) (Backend)

## What MyPVit is

MyPVit is a payment provider used for **mobile money and card payments**.

## What we use it for

Through the backend “Mobile Payments” module, we use MyPVit to:

- Initiate mobile money payments (e.g., Airtel Money, Moov Money)
- Initiate card payments (Visa/Mastercard) where applicable
- Receive callbacks/webhooks when a payment succeeds or fails

Existing technical doc:

- `apps/backend/src/mobile-payments/README.md`

## Configuration required (Backend)

MyPVit settings used by the backend:

- `MYPVIT_BASE_URL`
- `MYPVIT_MERCHANT_SLUG`
- `MYPVIT_ENVIRONMENT` (`test` or `production`)

Secret keys (provider credentials):

- `AIRTEL_MYPVIT_SECRET_KEY`
- `MOOV_MYPVIT_SECRET_KEY`

Callback / endpoint codes:

- `MYPVIT_CALLBACK_URL_CODE`
- `MYPVIT_SECRET_REFRESH_URL_CODE`
- `MYPVIT_PAYMENT_ENDPOINT_CODE`
- `MYPVIT_STATUS_ENDPOINT_CODE`

Merchant operation account codes:

- `MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE`
- `MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE`

Base URL of our backend (used to build callback URLs in some flows):

- `API_BASE_URL`

## What else is needed outside code

- A MyPVit merchant account with the correct payment products enabled
- Correct callback/webhook URLs registered on the MyPVit side

## What can break

- Payments fail to initiate if secret keys are missing/invalid
- Status checks/callback verification can fail if endpoint codes don’t match the environment

