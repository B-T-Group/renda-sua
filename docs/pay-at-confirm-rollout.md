# Pay-at-confirm rollout runbook and Cameroon pilot

Epic: #410 · Phase 3 (#420). Related PRs: #424 (cooked/goods rules by line snapshot), #425 (flag, kill switch, checkout rules, 45-min sweeper), #426 (settings toggle).

**What it is.** Per-location flag `business_locations.pay_at_confirm` (default `false`). When a MoMo, non-diaspora, pickup/delivery, ASAP order contains a line from a flagged location (and the global kill switch is on), the client places the order **without paying**, the store confirms, then the client is asked to pay. Unpaid orders are auto-cancelled (45 min for stock-tracked goods, 3 h for cooked food). A store may cancel a paid pay-after order and the client is refunded.

**Not covered by the flag:** shipping, rentals, Stripe rail, scheduled (non-ASAP) orders, clients whose wallet covers the order (they pay immediately), diaspora/gift checkout.

## 1. Deploy order (do not reorder)

1. **DB migration + Hasura metadata** — `20261001150000_business_locations_pay_at_confirm` (column default `false`; kill-switch row `pay_after_confirm_location_flag_enabled` = `false`). Apply to staging first, then prod by the normal release process (never by hand from a feature branch).
2. **Backend.** With the column and kill switch both off, behavior is unchanged. Backend must go before clients so new apps never send fields to an old DTO.
3. **Web** (ships with the backend cadence).
4. **Mobile OTA** (client checkout, business confirm UI, settings toggle). Wait for OTA propagation before enabling merchants, or restrict the pilot to merchants who use the web dashboard. Old business apps lack the generic confirm UI; the backend tolerates this (confirm without ready-in minutes) but verify on a device before the pilot.

## 2. Pre-flight checklist

- [ ] Staging UAT with MoMo sandbox: place → store confirms → client pays → order progresses (pickup and delivery).
- [ ] Unpaid timeout: confirm, do not pay, verify auto-cancel at ~45 min (goods) and that cooked food keeps 3 h.
- [ ] Store cancels a **paid** pay-after order → client refunded.
- [ ] Wallet-covered client pays immediately (no pay-after path).
- [ ] Mixed cart: one flagged location line makes the whole cart pay-after.
- [ ] Owner-only: an admin editing another business gets 403 on `pay_at_confirm`; toggle hidden for Stripe-rail locations.
- [ ] `docs/platform-capabilities.md` "Changes since" rows are present for #411–#418.
- [ ] #409 / #406 merged or rebased.

## 3. Pilot

Pick **1–2 trusted MoMo stores in Cameroon**. Record the location IDs in the rollout ticket.

Enable:

```sql
UPDATE business_locations SET pay_at_confirm = true WHERE id IN ('<location-id-1>', '<location-id-2>');
-- then switch the global kill switch on for the pilot window
UPDATE application_configurations
SET boolean_value = true
WHERE config_key = 'pay_after_confirm_location_flag_enabled' AND country_code IS NULL;
```

(The kill-switch row is global and created by the migration with `boolean_value = false`; it can also be edited from the admin configurations list.)

MoMo payment before delivery is accepted for these locations even though `momo_pay_now_delivery_enabled` is off in that market (locked decision).

## 4. Monitoring

Run daily during the pilot (and after any incident). Adjust column names to the live schema.

```sql
-- Flagged orders by status (last 7 days)
SELECT current_status, payment_status, count(*)
FROM orders
WHERE pay_after_merchant_confirm = true AND created_at > now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Sweeper health: confirmed-unpaid pay-after orders older than the unpaid window + grace.
-- Expect 0 rows for goods older than ~55 min and cooked food older than ~3 h 10 min.
SELECT o.id, o.created_at, h.created_at AS confirmed_at, o.payment_status
FROM orders o
JOIN LATERAL (
  SELECT created_at FROM order_status_history
  WHERE order_id = o.id AND status = 'confirmed'
  ORDER BY created_at DESC LIMIT 1
) h ON true
WHERE o.pay_after_merchant_confirm = true
  AND o.current_status = 'confirmed'
  AND o.payment_status NOT IN ('paid', 'authorized')
  AND h.created_at < now() - interval '55 minutes'
ORDER BY h.created_at;
```

Also track (from logs/analytics): unpaid auto-cancel count; payment failure/retry rate after confirm; store-cancel-after-paid and refund count; conversion vs. pre-pilot for the pilot stores; any paid order without holds after a MoMo credit. Log source for the sweeper: `UnpaidPayAfterSweeperService` (every 10 min) — look for `Unpaid pay-after sweep failed`.

## 5. Rollback

1. **Instant, no deploy:** set kill switch `pay_after_confirm_location_flag_enabled` to `false`. New orders revert to the normal payment flow.
2. And/or `UPDATE business_locations SET pay_at_confirm = false WHERE id IN (...)`.
3. **In-flight orders** keep their `pay_after_merchant_confirm` snapshot and continue (store confirms, client pays, or the sweeper cancels). No manual action is needed unless an order is stuck (see support runbook).
4. Rehearse once on staging before the pilot.

## 6. Support runbook

| Situation | What to do |
|---|---|
| Client says they were not asked to pay | Check the order is `confirmed` with `pay_after_merchant_confirm = true`; ask the client to open the order and use the pay prompt (the pay request is also sent as a notification when the store confirms). |
| MoMo payment failed | Client can retry from the order; the order stays unpaid until the unpaid window ends. If it is about to expire and the client is paying, ask the store to re-place the order after cancel. |
| Order auto-cancelled while client was paying | If money was received after cancel, treat as a refund case via the existing refund-request flow (do not re-open). |
| Store cannot fulfil after payment | Store cancels the paid order; the client is refunded automatically. Confirm the refund appears. |
| Disputed fee | Fee rules by phase: cancellation fee applies only after a pay-after order is paid. Check the order's fee lines and the fee matrix in `docs/platform-capabilities.md`. |
| Failed delivery | **Known gap G-5:** items are not refunded automatically on failed delivery. Handle manually via refund requests. Exposure increases with pay-after volume; flagged for follow-up. |

## 7. Go / no-go to widen beyond the pilot

Suggested (agree thresholds with the team before the pilot starts):

- ≥ 2 weeks with no money discrepancies (every paid order has holds; every cancelled-paid order is refunded).
- Sweeper healthy: monitoring query 2 returns 0 rows throughout.
- Unpaid-cancel rate and payment-failure rate acceptable to the pilot merchants; conversion not worse than pre-pilot.
- No unresolved support escalations tied to pay-after; G-5 handling decision made.
- Old business app versions below the OTA are no longer in use by pilot stores.

## 8. Docs

Per `.cursor/rules/platform-capabilities.mdc`, update `docs/platform-capabilities.md` (Changes since, flags table, gaps register) whenever this feature changes.
