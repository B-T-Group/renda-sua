# Resend (Frontend)

## What Resend is

Resend is the service we use to send **transactional emails** (for example: order updates).

## Does the frontend talk to Resend directly?

No. The frontend **never sends emails directly** via Resend.

Instead:

- The frontend triggers actions (like “place order”).
- The backend sends the actual email via Resend.

## Configuration required (Frontend)

None.

