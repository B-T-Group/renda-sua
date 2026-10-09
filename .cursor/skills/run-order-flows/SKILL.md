---
name: run-order-flows
description: >-
  Drives core Rendasua orders on the dev API as
  besongsamueloru+mm@gmail.com (client, business, and agent) until each order
  is complete, then prints a step report. Use when the user runs
  /run-order-flows or asks to test a food order, pay-after-confirm,
  pay-at-delivery, or pay-at-pickup flow through the API.
---

# Run order flows

Place a real order on **dev** with one multi-persona account, act as client, business, and agent, and finish at `current_status = complete`.

Endpoint bodies and sequences: [reference.md](reference.md).

## Hard rules

- Base URL: `https://dev.api.rendasua.com/api`. Refuse any prod host (`prod.api.rendasua.com`).
- Account: `besongsamueloru+mm@gmail.com`. OTP is always `0000` on the **SMS** channel (the phone on the account). Do not try another code.
- Never print, log, or commit the access token. Redact `Authorization` and tokens in the report.
- Do not send `x-rendasua-platform: mobile` (claim then requires in-app location consent).
- Do not cancel the order. On the first failed step, stop **that** flow, restore flags, and continue if more flows were selected.
- Quantity is always 1. Every Mobile Money charge (order total, deposit, pay-after charge, remainder, agent hold top-up) must be **under 2000 XAF**. Dev FreemoPay mock succeeds below 2000 and fails at 2000 or above, then callbacks in about 1.5s.
- Restore every location or item flag you changed, including after a failure.

## 1. Choose the flow

If the user did not name one, ask once (single select) before any API call:

- `food` — cooked item, delivery
- `pay_after_confirm` — non-cooked item, delivery, pay after confirm
- `pay_at_delivery` — non-cooked item, delivery
- `pay_at_pickup` — non-cooked item, store pickup
- `all` — those four, in that order

## 2. Sign in once

`x-client-platform: mobile` on both login calls so `access_token` is in the JSON body.

1. `POST /auth/login/start-otp` `{ "email": "besongsamueloru+mm@gmail.com", "channel": "sms" }`
2. `POST /auth/login/verify-otp` same email, `channel: "sms"`, `otp: "0000"`

If verify fails, stop. The phone on the account must be a dev test phone.

Later calls: `Authorization: Bearer <token>` and `X-Active-Persona: client|business|agent`.

## 3. Prepare the cart

Switch persona with the header (optional mirror: `POST /users/me/active-persona` `{ "persona": "..." }`).

1. **Business** `GET /business-items/page-data`. Pick the cheapest in-stock line: `business_inventories[].computed_available_quantity > 0`, `is_active`, `selling_price` lowest. Food requires `is_cooked_food`. The other flows require a non-cooked item. Note `business_inventory.id`, item id, location id, location `address.country`, and the current `pay_at_confirm`, `pay_at_pickup_enabled`, and `pay_on_delivery_enabled`.
2. **Client** `GET /addresses`. Use an address whose `country` matches the location. Pickup does not need one.
3. **Client** `POST /orders/checkout/preflight` with the same body you will send to create (no `delivery_window`). Read `groups[0].total`, `deposit_amount`, `amount_due`, `allowed_payment_timings`, and `pay_after_merchant_confirm_eligible`.

Enable a flag only when preflight rejects the timing or does not show pay-after eligibility. Record the previous value.

| Flow | Flag | When |
|------|------|------|
| Pay after confirm | `PATCH /business-items/locations/:locationId` `{ "pay_at_confirm": true }` | `pay_after_merchant_confirm_eligible` is not true |
| Pay at pickup | `PATCH /business-items/items/:itemId` `{ "pay_at_pickup_enabled": true }` | timing not allowed |
| Pay at delivery | `PATCH /business-items/items/:itemId` `{ "pay_on_delivery_enabled": true }` | timing not allowed |

Re-run preflight after a flag change. If pay-after is still ineligible, stop and say the location kill switch is off. Do not edit `application_configurations`.

Refuse create when any charge that MoMo will collect is **>= 2000**:

- pay now / pay after: `groups[0].total`
- pay at delivery or pickup with a deposit: `deposit_amount`, and later the remainder `amount_due`
- agent top-up: `holdAmount` from claim-availability

Pick a cheaper in-stock line, or stop that flow if none qualifies.

## 4. Run the flow

Create as **client** `POST /orders`. Then follow the sequence in [reference.md](reference.md).

After any response that started a MoMo charge (`pending_payment`, or `payment_status` still unpaid while a payment was just requested), poll `GET /orders/:id` about every 2s for up to 20s until `payment_status` is `paid` or `authorized`. Pay-at-delivery and pay-at-pickup stay unpaid until the doorstep or pickup payment step. Pay-after charges at **confirm**, not at create: poll after confirm, before marking ready.

`GET /orders/:id/delivery-pin` is **one-time** (a second call returns 410). Fetch it as client immediately before `complete-delivery`, and only if the order is not already `complete`.

## 5. Restore and report

Set each changed flag back to the value you saved.

Print one markdown report:

- Flow name, base URL, order id, order number
- Table: step, persona, method + path, HTTP status, `current_status`, `payment_status`
- Final status, or the failing response with tokens redacted
- Flags changed and whether restore succeeded

Do not claim an order is complete unless `current_status` is `complete`.
