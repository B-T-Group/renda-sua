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
| `verification_attention` | `rs_verification` | UTILITY | reason | URL CTA → `/app/verification` (static) |
| `delivery_pin` | `rs_delivery_pin` | UTILITY | pin, orderNumber | URL CTA → `/app/orders/{{1}}` |
| `pickup_reminder` | `rs_pickup_reminder` | UTILITY | orderNumber, window | URL CTA → `/app/orders/{{1}}` |
| `payment_failed` | `rs_payment_failed` | UTILITY | orderNumber | URL CTA → `/app/orders/{{1}}` |
| `ai_proposal_ready` | `rs_ai_proposal` | UTILITY | itemName | URL CTA → `/app/items/{{1}}` |

## Meta body rules (important)

- Do **not** start or end the body with a variable (`{{1}}`, `{{2}}`, …).
- Keep enough fixed text around variables (short bodies with many vars are rejected).
- Variable **order** must match the table above (backend positional params).
- Category: **Utility** for all.
- Dynamic URL buttons use base path + `{{1}}` for the entity id only. `rs_verification` is a **static** URL (no button parameter).

---

## 1. `rs_order_new`

**Vars:** `{{1}}` orderNumber · `{{2}}` customerName · `{{3}}` pickupWindow  
**Button:** Open order → `https://rendasua.com/app/orders/{{1}}`

**en_US**
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

---

## 2. `rs_delivery_offer`

**Vars:** `{{1}}` pickupArea · `{{2}}` distance  
**Button:** View offer → `https://rendasua.com/app/deliveries/{{1}}`

**en_US**
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

**en_US**
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

**en_US**
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

**en_US**
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

**en_US**
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

## 7. `rs_delivery_pin`

**Vars:** `{{1}}` pin · `{{2}}` orderNumber  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en_US**
```
Rendasua delivery security code.

Your PIN is {{1}} for order {{2}}. Share this code only with your Rendasua agent at handover.

Keep this message private.
```

**fr**
```
Code de sécurité de livraison Rendasua.

Votre code PIN est {{1}} pour la commande {{2}}. Partagez ce code uniquement avec votre agent Rendasua lors de la remise.

Gardez ce message confidentiel.
```

---

## 8. `rs_pickup_reminder`

**Vars:** `{{1}}` orderNumber · `{{2}}` window  
**Button:** View order → `https://rendasua.com/app/orders/{{1}}`

**en_US**
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

**en_US**
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

**en_US**
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

## Ops notes

1. After approval, set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
2. Keep `WHATSAPP_NOTIFICATIONS_ENABLED` unset or `false` until templates are approved; then set it to `true`. Notifications stay off automatically while token/phone id/app secret are empty.
3. Users must explicitly opt in (`whatsapp_enabled`) with a verified phone.
