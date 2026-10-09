# Order-flow API reference

Base: `https://dev.api.rendasua.com/api`

Headers on every authenticated call:

```
Authorization: Bearer <access_token>
X-Active-Persona: client|business|agent
Content-Type: application/json
```

Login only (no bearer yet):

```
x-client-platform: mobile
```

Never send `x-rendasua-platform`.

## Login

```http
POST /auth/login/start-otp
{ "email": "besongsamueloru+mm@gmail.com", "channel": "sms" }

POST /auth/login/verify-otp
{ "email": "besongsamueloru+mm@gmail.com", "channel": "sms", "otp": "0000" }
```

Use `access_token` from the verify JSON. Do not print it.

Optional persona mirror (the header is what the API enforces):

```http
POST /users/me/active-persona
{ "persona": "client" }
```

## Discover

Business `GET /business-items/page-data` → `data.items[]`:

- `is_cooked_food`, `pay_at_pickup_enabled`, `pay_on_delivery_enabled`, `currency`, `price`
- `business_inventories[]`: `id` (this is `business_inventory_id`), `selling_price`, `computed_available_quantity`, `is_active`, `business_location_id`
- location on the inventory: `business_location.address.country`, and `pay_at_confirm` on `data.business_locations[]`

Client `GET /addresses` → `data.addresses[]` with `id` and `country`.

## Preflight and create

Same item shape for both. No `delivery_window` (pay-after and cooked food are ASAP-only).

```json
{
  "items": [{ "business_inventory_id": "<uuid>", "quantity": 1 }],
  "fulfillment_method": "delivery",
  "delivery_address_id": "<uuid>",
  "payment_timing": "pay_now"
}
```

| Flow | `fulfillment_method` | `delivery_address_id` | `payment_timing` |
|------|----------------------|------------------------|------------------|
| food | `delivery` | required | omit (server applies pay-after for cooked MoMo) |
| pay_after_confirm | `delivery` | required | omit |
| pay_at_delivery | `delivery` | required | `pay_at_delivery` |
| pay_at_pickup | `pickup` | omit | `pay_at_pickup` |

`POST /orders/checkout/preflight` then `POST /orders`.

Preflight fields that matter: `can_proceed`, `blocking_errors`, `groups[0].total`, `groups[0].deposit_amount`, `groups[0].amount_due`, `groups[0].allowed_payment_timings`, `groups[0].pay_after_merchant_confirm_eligible` (also on the root).

Create response: `order.id`, `order.order_number`, `order.current_status`, `order.payment_status`, `order.pay_after_merchant_confirm`, `order.total_amount`.

MoMo charges must be **< 2000** (XAF). Poll `GET /orders/:id` every ~2s, up to 20s, after a charge is requested, until `payment_status` is `paid` or `authorized`.

## Flag changes (restore after)

```http
PATCH /business-items/locations/:locationId
{ "pay_at_confirm": true }

PATCH /business-items/items/:itemId
{ "pay_at_pickup_enabled": true }

PATCH /business-items/items/:itemId
{ "pay_on_delivery_enabled": true }
```

Write back the boolean you read before the change.

## Shared status bodies

```json
{ "orderId": "<uuid>" }
```

| Action | Persona | Call |
|--------|---------|------|
| Confirm | business | `POST /orders/confirm` |
| Mark ready | business | `POST /orders/complete_preparation` |
| Claim check | agent | `GET /orders/:orderId/claim-availability` |
| Claim (wallet covers hold) | agent | `POST /orders/claim_order` |
| Claim (top up) | agent | `POST /orders/claim_order_with_topup` |
| Pick up from store | agent | `POST /orders/pick_up` |
| Transit | agent | `POST /orders/start_transit` |
| Out for delivery | agent | `POST /orders/out_for_delivery` |
| Read PIN (once) | client | `GET /orders/:id/delivery-pin` |
| Complete delivery | agent | `POST /orders/complete-delivery` `{ "orderId", "pin" }` |
| Pay at the door | agent | `POST /orders/:id/initiate-pay-at-delivery-payment` `{}` |
| Client pickup done | client | `POST /orders/:id/complete-pickup` |

`claim-availability`: use `claim_order` when `hasEnoughFundsForHold` is true. Otherwise `claim_order_with_topup`, and only if `holdAmount` < 2000.

Cooked confirm may include `"ready_in_minutes": 15`.

## Sequences

Stop the flow at the first non-success. Read `GET /orders/:id` after each step and record `current_status` and `payment_status`.

### Food (delivery) and pay after confirm (delivery)

1. Client create.
2. If a MoMo charge started at create, poll until paid or authorized.
3. Business confirm. If `pay_after_merchant_confirm` is true, poll until paid or authorized before continuing.
4. Business `complete_preparation` (order becomes `ready_for_pickup`).
5. Agent claim (wallet or top-up).
6. Agent `pick_up` → `start_transit` → `out_for_delivery`.
7. Client `GET /orders/:id/delivery-pin` once.
8. Agent `complete-delivery` with that PIN.
9. Expect `current_status` `complete`.

### Pay at delivery

1. Client create with `payment_timing: "pay_at_delivery"`.
2. If `deposit_amount` > 0, poll until that deposit is paid. Leave the remainder unpaid.
3. Business confirm → `complete_preparation`.
4. Agent claim → `pick_up` → `start_transit` → `out_for_delivery`.
5. Agent `POST /orders/:id/initiate-pay-at-delivery-payment`.
6. Poll until `payment_status` is paid or authorized. The callback may already set `current_status` to `complete`.
7. If still `out_for_delivery`, client reads the PIN once and agent `complete-delivery`.
8. Expect `complete`.

### Pay at pickup

No agent.

1. Client create with `fulfillment_method: "pickup"` and `payment_timing: "pay_at_pickup"`.
2. If a deposit charge started, poll until that deposit is paid.
3. Business confirm → `complete_preparation`.
4. Client `POST /orders/:id/complete-pickup`.
5. If a remainder charge started, poll until paid or authorized and `current_status` is `complete`.
6. Expect `complete`.

## Report row

| Step | Persona | Request | HTTP | current_status | payment_status |
|------|---------|---------|------|----------------|----------------|
| Confirm | business | POST /orders/confirm | 200 | confirmed | pending |
