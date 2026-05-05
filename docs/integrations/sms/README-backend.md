# MTN & Orange SMS (Backend)

## What these integrations are

MTN and Orange provide telecom APIs that can send **SMS text messages**. We use SMS as a fallback or additional channel for certain important events (example: order delivered/complete/cancelled).

## How SMS is used in this repo

- SMS is controlled by a global toggle: `SMS_ENABLED=true`
- The backend has providers for:
  - **Orange SMS** (currently the default provider used by `SmsService`)
  - **MTN SMS** (implemented, but not wired as the default provider today)

## Configuration required (Backend)

### Global SMS switch

- `SMS_ENABLED` (`true` or `false`)

### Orange SMS configuration (used today)

- `ORANGE_SMS_CLIENT_ID` (or `ORANGE_CLIENT_ID`)
- `ORANGE_SMS_CLIENT_SECRET` (or `ORANGE_CLIENT_SECRET`)
- `ORANGE_SMS_BASE_URL` (defaults to `https://api.orange.com`)
- `ORANGE_SMS_SENDER_NUMBER` (or `ORANGE_SENDER_NUMBER`)  
  - Expected format: `tel:+<number>` (the code will normalize `+...` too)
- `ORANGE_SMS_SENDER_NAME` (or `ORANGE_SENDER_NAME`) (defaults to `Rendasua`)

### MTN SMS configuration (available but not default)

- `MTN_SMS_CLIENT_ID`
- `MTN_SMS_CLIENT_SECRET`
- `MTN_SMS_SERVICE_CODE`
- `MTN_SMS_BASE_URL` (defaults to `https://api.mtn.com`)
- `MTN_SMS_SENDER_ADDRESS` (optional override)

## Operational notes (non-technical)

- These are **telecom credentials** tied to a specific operator account and short code.
- In production, these values must be stored in a secret manager (not in source code).

## What can break

- If `SMS_ENABLED` is off, the backend will skip SMS entirely.
- If Orange credentials are missing, SMS calls will fail.
- If the sender number or operator setup is incorrect, messages may be rejected.

