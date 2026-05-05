# Twilio (Backend)

## What Twilio is

Twilio is commonly used to send SMS and make phone calls.

## How it’s used in this repo (current state)

- The backend configuration includes Twilio environment variables and the dependency exists in `package.json`.
- **However, the current SMS sending path uses Orange SMS** (see `docs/integrations/sms/README-backend.md`).
- Treat Twilio as **available/optional** rather than active today.

## Configuration keys present (Backend)

If Twilio is enabled in the future, these are the keys already modeled in backend config:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

And the global SMS toggle:

- `SMS_ENABLED=true`

## What can break

Nothing today, since Twilio is not actively used by the runtime SMS service.

