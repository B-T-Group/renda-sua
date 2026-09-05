# WhatsApp Meta template submission checklist

Submit these templates in Meta Business Manager (WhatsApp → Message templates) for **en** and **fr** before enabling `WHATSAPP_NOTIFICATIONS_ENABLED` in production.

Those two codes are the only ones the backend asks for (`WhatsAppTemplateService.languageCode`). A template approved under any other translation — `en_US` in particular — is rejected at send time with **#132001 Template name does not exist in the translation**, so add the `en` translation rather than changing the code.

Internal keys are mapped in `WhatsAppTemplateService`.

| Internal key | Meta name | Category | Body variables (positional) | Button |
|--------------|-----------|----------|-------------------------------|--------|
| `order_created_business` | `rs_order_created` | UTILITY | orderNumber, customerName, pickupWindow | URL CTA → `/app/orders/{{1}}` |
| `order_action_business` | `rs_order_action` | UTILITY | orderNumber, customerName, pickupWindow | QUICK_REPLY: Confirm / Need more time / Decline |
| `order_offer_agent` | `rs_delivery_offer` | **MARKETING** | pickupArea, distance | URL CTA → `/app/deliveries/{{1}}` |
| `order_status_client` | `rs_order_status` | UTILITY | orderNumber, statusLabel | URL CTA → `/app/orders/{{1}}` |
| `order_ready` | `rs_order_ready` | UTILITY | orderNumber | URL CTA → `/app/orders/{{1}}` |
| `rental_request_business` | `rs_rental_request` | UTILITY | itemName, dates | URL CTA → `/app/rentals/requests/{{1}}` |
| `verification_attention` | `rs_verification` | UTILITY | reason | URL CTA → `/app/verification` (static) |
| `delivery_pin` | `rs_delivery_pin` | **AUTHENTICATION** | pin (code only) | OTP copy-code button (no URL CTA) |
| — (Auth0) | `rs_login_code` | **AUTHENTICATION** | code only | OTP copy-code button (no URL CTA) |
| `pickup_reminder` | `rs_pickup_reminder` | UTILITY | orderNumber, window | URL CTA → `/app/orders/{{1}}` |
| `payment_failed` | `rs_payment_failed` | UTILITY | orderNumber | URL CTA → `/app/orders/{{1}}` |
| `ai_proposal_ready` | `rs_ai_proposal` | UTILITY | itemName | URL CTA → `/app/items/{{1}}` |
| `admin_order_risk` | `rs_admin_order_risk` | UTILITY | orderNumber, riskLabel, reason | URL CTA → `/app/admin/orders/{{1}}` |
| `recipient_order_update` | `rs_recipient_order_update` | UTILITY | orderNumber, statusLabel | URL CTA → `/app/orders/{{1}}` |

## Meta body rules (important)

- Do **not** start or end the body with a variable (`{{1}}`, `{{2}}`, …).
- Keep enough fixed text around variables (short bodies with many vars are rejected).
- Variable **order** must match the table above (backend positional params).
- Dynamic URL buttons use base path + `{{1}}` for the entity id only. `rs_verification` is a **static** URL (no button parameter).

## Category drives transport

Meta owns the category and **can recategorize a template after approval**, so the `Category` column above must be re-checked against WhatsApp Manager. `TEMPLATE_CATEGORIES` in `whatsapp-template.service.ts` mirrors it, and `WhatsAppService` routes on it:

| Category | Endpoint | Notes |
|---|---|---|
| UTILITY / AUTHENTICATION | `/PHONE_NUMBER_ID/messages` (Cloud API) | Default. |
| MARKETING | `/PHONE_NUMBER_ID/marketing_messages` (Marketing Messages API) | Only when `WHATSAPP_MARKETING_MESSAGES_API_ENABLED=true`; otherwise falls back to Cloud API, which still carries non-optimized marketing. |

Sending marketing over the Marketing Messages API needs the WABA to sign the MM API Terms of Service in WhatsApp Manager first; check `marketing_messages_onboarding_status` on the WABA for `ELIGIBLE` / `ONBOARDED`. See [Meta's onboarding guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/onboarding). Both APIs use the same registered phone number.

Marketing templates are also priced as marketing and are subject to WhatsApp's **per-user marketing message limits**, so a send can be dropped even when Graph accepts it. Do not rely on a marketing template as the only path for anything operational.

---

## 1. `rs_order_created`

**Vars:** `{{1}}` orderNumber · `{{2}}` customerName · `{{3}}` pickupWindow  
**Button:** Open order → `https://rendasua.com/app/orders/{{1}}`

**en**
```
Rendasua: you have a new marketplace order.

Order number: {{1}}
Customer name: {{2}}
Please confirm within {{3}} so the customer is not left waiting.

Tap below to open the order in Rendasua.
```

**fr**
```
Rendasua : vous avez une nouvelle commande marketplace.

Numéro de commande : {{1}}
Nom du client : {{2}}
Veuillez confirmer sous {{3}} pour ne pas faire attendre le client.

Appuyez ci-dessous pour ouvrir la commande dans Rendasua.
```

## 1b. `rs_order_action`

**Vars:** `{{1}}` orderNumber · `{{2}}` customerName · `{{3}}` pickupWindow  
**Buttons:** QUICK_REPLY Confirm / Need more time / Decline (inbound ids: `confirm`, `busy`, `decline`)

**en**
```
Rendasua: you have a new marketplace order.

Order number: {{1}}
Customer name: {{2}}
Please confirm within {{3}} so the customer is not left waiting.

Tap a button below to respond.
```

**fr**
```
Rendasua : vous avez une nouvelle commande marketplace.

Numéro de commande : {{1}}
Nom du client : {{2}}
Veuillez confirmer sous {{3}} pour ne pas faire attendre le client.

Appuyez sur un bouton ci-dessous pour répondre.
```

Until Meta approves `rs_order_action`, production keeps sending `rs_order_created`. After approval, prefer internal key `order_action_business`.

---

## 2. `rs_delivery_offer` (MARKETING)

**Vars:** `{{1}}` pickupArea · `{{2}}` distance  
**Button:** View offer → `https://rendasua.com/app/deliveries/{{1}}`

Meta categorizes this one as **marketing**, so it is priced as marketing, capped by per-user marketing limits, and routed through the Marketing Messages API when onboarding is complete. Push remains the primary channel for offers; WhatsApp is best-effort.

**en**
```
Rendasua: a new delivery offer is available near you.

Pickup area: {{1}}
Distance from you: about {{2}} km.

Open the app soon to accept or decline this offer before it expires.
```

**fr**
```
Rendasua : une nouvelle offre de livraison est disponible près de vous.

Zone de récupération : {{1}}
Distance approximative : {{2}} km.

Ouvrez l’application rapidement pour accepter ou refuser cette offre avant qu’elle n’expire.
```

---

## 3. `rs_order_status`

**Vars:** `{{1}}` orderNumber · `{{2}}` statusLabel  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en**
```
Rendasua order update for you.

Your order {{1}} status is now: {{2}}.

Open the app for full details and next steps.
```

**fr**
```
Mise à jour de votre commande Rendasua.

Le statut de votre commande {{1}} est maintenant : {{2}}.

Ouvrez l’application pour voir les détails et la suite.
```

---

## 4. `rs_order_ready`

**Vars:** `{{1}}` orderNumber  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en**
```
Rendasua: your order is ready for pickup.

Order number {{1}} can be collected now. Please come to the store or follow the pickup instructions in the app.

See you soon.
```

**fr**
```
Rendasua : votre commande est prête pour le retrait.

La commande {{1}} peut être récupérée maintenant. Rendez-vous au magasin ou suivez les instructions de retrait dans l’application.

À bientôt.
```

---

## 5. `rs_rental_request`

**Vars:** `{{1}}` itemName · `{{2}}` dates  
**Button:** Review request → `https://rendasua.com/app/rentals/requests/{{1}}`

**en**
```
Rendasua: you received a new rental request.

Item: {{1}}
Requested dates: {{2}}

Please review and respond in the app so the renter gets a timely answer.
```

**fr**
```
Rendasua : vous avez reçu une nouvelle demande de location.

Article : {{1}}
Dates demandées : {{2}}

Veuillez examiner et répondre dans l’application pour informer rapidement le locataire.
```

---

## 6. `rs_verification`

**Vars:** `{{1}}` reason  
**Button (static):** Open documents → `https://rendasua.com/app/verification`

**en**
```
Rendasua: your account verification needs attention.

Reason: {{1}}

Please update your documents in the app so we can continue the review.
```

**fr**
```
Rendasua : votre vérification de compte nécessite une action.

Motif : {{1}}

Veuillez mettre à jour vos documents dans l’application afin que nous puissions poursuivre l’examen.
```

---

## 7. `rs_delivery_pin` (AUTHENTICATION)

**Authentication template (see also `rs_login_code`).** It does not follow the utility contract above. Authentication templates are created in Meta with a fixed body plus an `OTP` button (`otp_type: COPY_CODE`) — you do not author the body copy, you only toggle the security recommendation and the code expiry. Pricing and time-to-live also differ from utility.

**Vars:** `{{1}}` pin — the code and nothing else  
**Button:** OTP copy-code (no URL CTA; the template's `ctaUrl` is ignored)

The send payload repeats the code in **both** the body and the button. `WhatsAppTemplateService.buildAuthComponents` produces this; do not route it through the utility path:

```json
"components": [
  { "type": "body",
    "parameters": [{ "type": "text", "text": "123456" }] },
  { "type": "button", "sub_type": "url", "index": "0",
    "parameters": [{ "type": "text", "text": "123456" }] }
]
```

Meta keeps the send-time `sub_type` as `url` even though the button is created as type `OTP`. Adding a second body parameter (for example the order number) is rejected on parameter count.

Authentication templates go through **Cloud API** `/{phone-number-id}/messages`, the same transport as every other template here. MM Lite / Marketing Messages API only optimizes *marketing* sends and does not apply.

> Not currently sent. No code passes `templateKey: 'delivery_pin'`; the delivery PIN notification is push-only. Wire it through the orchestrator before relying on it.

---

## 8. `rs_pickup_reminder`

**Vars:** `{{1}}` orderNumber · `{{2}}` window  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en**
```
Rendasua pickup reminder for your assigned order.

Order {{1}} should be picked up by {{2}}. Please head to the store if you have not already collected it.

Open the app for the order details.
```

**fr**
```
Rappel de récupération Rendasua pour votre commande assignée.

La commande {{1}} doit être récupérée avant {{2}}. Rendez-vous au magasin si vous ne l’avez pas encore prise.

Ouvrez l’application pour les détails de la commande.
```

---

## 9. `rs_payment_failed`

**Vars:** `{{1}}` orderNumber  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en**
```
Rendasua could not complete a payment for your order.

Payment failed for order {{1}}. Please update your payment method or try again in the app so the order can proceed.

We are here if you need help.
```

**fr**
```
Rendasua n’a pas pu finaliser un paiement pour votre commande.

Le paiement a échoué pour la commande {{1}}. Veuillez mettre à jour votre moyen de paiement ou réessayer dans l’application pour que la commande puisse continuer.

Nous sommes disponibles si vous avez besoin d’aide.
```

---

## 10. `rs_ai_proposal`

**Vars:** `{{1}}` itemName  
**Button:** Review → `https://rendasua.com/app/items/{{1}}`

**en**
```
Rendasua: an AI listing suggestion is ready for review.

Suggested listing for {{1}} is waiting in your business workspace. Please open the app to approve, edit, or dismiss it.

Thanks for selling with Rendasua.
```

**fr**
```
Rendasua : une suggestion de fiche IA est prête à être examinée.

La suggestion pour {{1}} attend dans votre espace commerçant. Ouvrez l’application pour l’approuver, la modifier ou la rejeter.

Merci de vendre avec Rendasua.
```

---

## 11. `rs_admin_order_risk`

Sent to platform staff (`superuser`, `order_manager`) and to the agent who referred the merchant, so the audience is internal rather than customer-facing.

**Vars:** `{{1}}` orderNumber · `{{2}}` riskLabel · `{{3}}` reason  
**Button:** Open order → `https://rendasua.com/app/admin/orders/{{1}}`

`riskLabel` is one of: Not confirmed by merchant, Confirmed but not ready, Ready with no agent, Waiting to be collected, Agent has not picked up, Delivery running late.

`reason` is a single line built by `buildOrderRiskActionSummary` carrying the merchant, the phone number to call, the client, the amount, and the time left — capped at 300 characters.

**en**
```
Rendasua: an order needs your intervention.

Order {{1}} is flagged as: {{2}}.
Details: {{3}}

Open the admin panel to contact the client, the business, or the agent.
```

**fr**
```
Rendasua : une commande nécessite votre intervention.

La commande {{1}} est signalée : {{2}}.
Détails : {{3}}

Ouvrez le panneau d’administration pour contacter le client, le commerçant ou le livreur.
```

---

## 12. `rs_login_code` (AUTHENTICATION, Auth0)

Auth0 sends this login OTP. It is **not** mapped in `WhatsAppTemplateService` and is not sent by Nest.

**Vars:** `{{1}}` code — the code and nothing else  
**Button:** OTP copy-code (`otp_type: COPY_CODE`)  
**Create flags (match WhatsApp Manager):** security recommendation **on**, no code-expiry footer, message validity **10 minutes** (`message_send_ttl_seconds: 600`)

Meta owns the body copy. Do not submit custom en/fr strings.

---

## 13. `rs_recipient_order_update`

**Vars:** `{{1}}` orderNumber · `{{2}}` statusLabel  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

Recipient order status update for diaspora recipients (third-party recipients who do not have a Rendasua account). Meta **rejected** dedicated recipient UTILITY names (`rs_recipient_order_placed`, `rs_rcpt_out_for_delivery`, `rs_recipient_order_ready`) with INCORRECT_CATEGORY, so all recipient status notifications now use this single template. SMS remains the fallback channel.

**en**
```
Rendasua order update for you.

Order number {{1}} status: {{2}}.

The person who placed this order for you will receive full details.
```

**fr**
```
Mise à jour de commande Rendasua pour vous.

Numéro de commande {{1}}, statut : {{2}}.

La personne qui a passé cette commande pour vous recevra tous les détails.
```

---

## Rejected templates (do not submit)

Meta rejected the following template names with **INCORRECT_CATEGORY**. Do **not** create or submit these in Meta Business Manager:

- `rs_recipient_order_placed`
- `rs_rcpt_out_for_delivery` 
- `rs_recipient_order_ready`

These were intended as dedicated UTILITY templates for diaspora recipient order notifications (placed, out for delivery, ready for pickup). Meta's rejection reason suggests they should be MARKETING instead, which is not appropriate for transactional order status updates.

**Workaround:** Use `rs_recipient_order_update` (approved UTILITY) with appropriate `statusLabel` values for all recipient order status notifications. Keep SMS as the fallback channel.

---

## Admin test send

Superusers (or `platform.ops.user_messages`) can list catalog params and send a live template without waiting on the product `WHATSAPP_NOTIFICATIONS_ENABLED` flag. Graph credentials must still be configured.

- `GET /api/admin/whatsapp/templates?category=UTILITY`
- `POST /api/admin/whatsapp/templates/test`

`templateId` is the internal key **or** the Meta name. Body fields must match `Body variables` above. Templates with a dynamic URL button also need `entityId` (or a full `ctaUrl`).

Import `apps/backend/postman/Rendasua.postman_collection.json` for ready-made examples.

---

## Ops notes

1. After approval, set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
2. Set `WHATSAPP_NOTIFICATIONS_ENABLED=true` after templates are approved. Notifications stay off automatically while token/phone id/app secret are empty.
3. Users with a phone number are opted in (`whatsapp_enabled`) by default.
4. Create or update all `en`/`fr` templates (including `rs_login_code`) with:

```bash
npm run create:whatsapp-templates -- --access-token "$TOKEN"
```

WABA id defaults to `1014752277854609` and Graph API to `v25.0`. Override with `--waba-id` / `WHATSAPP_WABA_ID` or `--api-version`.

Missing name+language rows are created. Existing translations are updated in place when body or buttons differ; unchanged rows are skipped so Meta does not re-review them. Use `--dry-run` to print payloads. Edited templates go back to `PENDING` review.

**Approved templates cannot have their body or buttons changed.** Graph will not let you recreate a name that is still in `PENDING_DELETION` (Meta holds the name for **4 weeks**). `rs_order_new` is in that lock; merchant new-order sends use **`rs_order_created`** instead:

```bash
npm run create:whatsapp-templates -- --only rs_order_created --access-token "$TOKEN"
```

Sends work after the new `en` / `fr` rows are **APPROVED**. For other names that are approved but not deleting, `--force-recreate NAME` deletes then creates — only use that when Meta is not in the 4-week name lock.
