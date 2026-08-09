# WhatsApp Meta template submission checklist

Submit these templates in Meta Business Manager (WhatsApp → Message templates) for **en_US** and **fr** before enabling `WHATSAPP_NOTIFICATIONS_ENABLED` in production.

Internal keys are mapped in `WhatsAppTemplateService`.

| Internal key | Meta name | Category | Body variables (positional) | Button |
|--------------|-----------|----------|-------------------------------|--------|
| `order_created_business` | `rs_order_new` | UTILITY | orderNumber, customerName, pickupWindow | URL CTA → `/app/orders/{{1}}` |
| `order_offer_agent` | `rs_delivery_offer` | UTILITY | pickupArea, distance | URL CTA → `/app/deliveries/{{1}}` |
| `order_status_client` | `rs_order_status` | UTILITY | orderNumber, statusLabel | URL CTA → `/app/orders/{{1}}` |
| `order_ready` | `rs_order_ready` | UTILITY | orderNumber | URL CTA → `/app/orders/{{1}}` |
| `rental_request_business` | `rs_rental_request` | UTILITY | itemName, dates | URL CTA → `/app/rentals/requests/{{1}}` |
| `verification_attention` | `rs_verification` | UTILITY | reason | URL CTA → `/app/verification` |
| `delivery_pin` | `rs_delivery_pin` | UTILITY | pin, orderNumber | URL CTA → `/app/orders/{{1}}` |
| `pickup_reminder` | `rs_pickup_reminder` | UTILITY | orderNumber, window | URL CTA → `/app/orders/{{1}}` |
| `payment_failed` | `rs_payment_failed` | UTILITY | orderNumber | URL CTA → `/app/orders/{{1}}` |
| `ai_proposal_ready` | `rs_ai_proposal` | UTILITY | itemName | URL CTA → `/app/items/{{1}}` |

## Sample English body — `rs_order_new`

```
New order #{{1}}

Customer: {{2}}
Pickup: {{3}}

Please confirm soon.
```

CTA button label: `Open Order` → dynamic URL suffix from DeepLinkService universal path.

## Ops notes

1. After approval, set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
2. Keep `WHATSAPP_NOTIFICATIONS_ENABLED` unset or `false` until templates are approved; then set it to `true`. Notifications stay off automatically while token/phone id/app secret are empty.
3. Users must explicitly opt in (`whatsapp_enabled`) with a verified phone.
