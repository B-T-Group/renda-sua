# Pay-at-confirm rollout runbook and Cameroon pilot

Epic: #410 · Phase 3 (#420). Related PRs: #424 (cooked/goods rules by line snapshot), #425 (flag, kill switch, checkout rules, 45-min unpaid timer + sweeper fallback), #426 (settings toggle).

**What it is.** Per-location flag `business_locations.pay_at_confirm` (default `false`). When a MoMo, non-diaspora, pickup/delivery, ASAP order contains a line from a flagged location (and the global kill switch is on), the client places the order **without paying**, the store confirms, then the client is asked to pay. Unpaid orders are auto-cancelled: the timer fires 45 min after the store confirms for stock-tracked goods (3 h for cooked food); if the timer is lost, the 10-minute sweeper cancels them after the window **plus a 15-minute grace** (~60 min for goods, ~3 h 15 min for cooked food). Customer-facing copy says "45 minutes". The store also has its own confirm deadline (see below). A store may cancel a paid pay-after order and the client is refunded.

**Store confirm deadline (separate from the pay window).** A pay-after order stays `pending` until the store confirms; the normal merchant acceptance SLA applies (default ASAP window 45 min, then a 15-min grace, after which the order is auto-declined, stock released). The 45-min pay window only starts at confirm.

**Not covered by the flag:** shipping, rentals, Stripe rail, scheduled (non-ASAP) orders, clients whose wallet covers the order (they pay immediately), diaspora/gift checkout.

## 1. Deploy order (do not reorder)

1. **DB migration + Hasura metadata** — `20261001150000_business_locations_pay_at_confirm` (column default `false`; kill-switch row `pay_after_confirm_location_flag_enabled` = `false`). Apply to staging first, then prod by the normal release process (never by hand from a feature branch).
2. **Backend.** With the column and kill switch both off, behavior is unchanged. Backend must go before clients so new apps never send fields to an old DTO.
3. **Web** (ships with the backend cadence).
4. **Mobile OTA** (client checkout, business confirm UI, settings toggle). Wait for OTA propagation before enabling merchants, or restrict the pilot to merchants who use the web dashboard. Old business apps lack the generic confirm UI; the backend tolerates this (confirm without ready-in minutes) but verify on a device before the pilot.

## 2. Pre-flight checklist

- [ ] Staging UAT with MoMo sandbox: place → store confirms → client pays → order progresses (pickup and delivery).
- [ ] Unpaid timeout: confirm, do not pay, verify auto-cancel at ~45 min (goods; up to ~60 min if the timer is lost and the sweeper cancels) and that cooked food keeps 3 h (up to ~3 h 15 min via the sweeper).
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

-- Sweeper health: confirmed-unpaid pay-after orders older than the unpaid window + the 15-min sweeper grace.
-- Expect 0 rows for goods older than ~60 min and cooked food older than ~3 h 15 min
-- (a few minutes of slack for the 10-minute cron: use 70 min / 3 h 30 min below).
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
  AND h.created_at < now() - (
    CASE WHEN EXISTS (
      SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.is_cooked_food IS NOT TRUE
    ) OR NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
    THEN interval '70 minutes'      -- goods (45 min + 15 min grace + cron slack)
    ELSE interval '3 hours 30 minutes' -- every line cooked (3 h + 15 min grace + slack)
    END)
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
| MoMo payment failed | Client can retry from the order (resend, or send to a different number); the order stays unpaid until the unpaid window ends. If it is about to expire and the client is paying, ask the store to re-place the order after cancel. |
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

## Client retry semantics (#545 PR-1)

`POST /orders/:id/retry-payment` on a confirmed pay-after-confirm MoMo order:

- Body `{ phone_number?, save_phone? }`, header `Idempotency-Key` (one per tap). Same key within 10 min returns the first result and sends nothing.
- The previous pending request is checked with the provider first. Provider SUCCESS -> order finalized, `result: paid`. Provider FAILED -> new request. Status unknown -> 409 `PAYMENT_STATE_UNCERTAIN` (never a blind second charge).
- Same phone: a new prompt replaces a pending one only after 90 s (`ORDER_MOMO_RESEND_MIN_AGE_SECONDS`), otherwise `result: already_pending`. A changed number (validated, MoMo operator, order country) replaces it immediately. Max 5 new requests per order per 10 min (429 `RETRY_RATE_LIMITED`). Operator prompts expire after about 5 min (`prompt_expires_at`).
- The replaced attempt is kept as `cancelled` with `error_code=SUPERSEDED_BY_RETRY`, `superseded_reason`, `superseded_at`, `superseded_by_id` on `mobile_payment_transactions`.
- A changed number is used for this order only and written to `orders.payer_phone` only after the provider accepts the request; `save_phone: true` also adds it to the client's payment phones.
- Late approval of a replaced prompt: first success wins and pays the order (any newer pending request is cancelled). A duplicate or post-cancel success stays in the client's Rendasua wallet, raises Sentry `duplicate_momo_collect` (grouped by that marker; unique order / tx text is extras, not a new issue) and pushes the client ("Payment added to your wallet"). Support: no MoMo refund needed, the client can spend or withdraw the wallet balance.

## QA follow-up (#545 PR-1b)

- Order MoMo success is claimed with a conditional write (`pending -> success`) before the
  order is finalized; a row a retry superseded goes to the late-success handler. After a
  success applies, other pending attempts on the paid order are cancelled.
- Retry caps across orders: one prompt per target number per 90 s, 5 per number per hour,
  10 per payer user per hour (`RETRY_RATE_LIMITED`, `scope: number|user`).
- `Idempotency-Key` reused with a different phone returns 422 `IDEMPOTENCY_KEY_REUSED`.
- Order cancel closes pending MoMo attempts (`SUPERSEDED_BY_ORDER_CANCEL`); the operator
  prompt itself cannot be withdrawn, a late approval is credited to the wallet.
- `CREATE INDEX CONCURRENTLY`: the DEV/prod Hasura server (v2.48) and CLI support
  `-- hasura:no-transaction`, but only with `--per-migration-transaction`, which
  `.github/actions/apply-hasura` does not pass, and the indexes already exist on DEV.
  Not changed here. Before the prod apply, run the read-only precheck in
  `/workspace/qa/pr545/results.md`; if the table is large, enable the flag in the apply
  action and pre-create the indexes concurrently, then the existing `IF NOT EXISTS`
  statements become no-ops.

## Client contract notes (N1, N2)

- **N2:** every "already paid" answer from `POST /orders/:id/retry-payment` carries `result: 'paid'`, including the short `{ success, message: 'Order is already paid' }` shape, so clients can switch on `result` alone.
- **N1:** when several retries race, for example a double tap, the losers may get 409 `PAYMENT_STATE_UNCERTAIN`; the winner already sent the prompt. Clients (PR-2 web, PR-3 mobile) should treat that 409 like `already_pending`. Show "A payment request was just sent, approve it on your phone", keep the order screen polling, and do not show an error or offer an immediate resend. A real uncertain state (the provider status check failed) resolves itself on the next retry after about a minute.

## Prod migration precheck and impact (N3)

Run these read-only queries on prod before applying `20261012120000_order_pending_tx_unique`:

```sql
-- table size: plain CREATE INDEX holds a write lock for the whole build
select count(*), pg_size_pretty(pg_total_relation_size('mobile_payment_transactions')) total
  from mobile_payment_transactions;
-- duplicate pending order payments the cleanup would cancel (all but the newest per order)
select entity_id, count(*), min(created_at), max(created_at) from mobile_payment_transactions
 where payment_entity='order' and status='pending' and entity_id is not null
 group by 1 having count(*) > 1;
-- of those, ones under 1 day old (possibly live prompts): must be 0 to proceed
select count(*) from (
  select row_number() over (partition by entity_id order by created_at desc) rn, created_at
    from mobile_payment_transactions
   where payment_entity='order' and status='pending' and entity_id is not null) t
 where rn > 1 and created_at > now() - interval '1 day';
```

- **Locking:** the migration builds its 2 unique indexes and 1 btree index **without `CONCURRENTLY`**, so writes to `mobile_payment_transactions` (every payment, callback and retry) block until each build finishes. That takes milliseconds for thousands of rows; if the table reaches millions of rows, pre-create the indexes concurrently (see above).
- **Dedupe impact:** for each order with more than one pending payment, every row except the newest becomes `cancelled`, with `error_code='SUPERSEDED_BY_RETRY'` and `superseded_reason='migration_duplicate_cleanup'`. Nothing is refunded or charged. If a customer later approves one of those prompts, the late-success handler credits the amount to their wallet and raises an alert. Rows with a NULL `entity_id` are not touched or covered by the index.
- **Prod result (2026-10-12):** 934 rows (688 kB), 0 duplicate pending order payments, 0 recent, 0 pending order payments overall. These numbers are from after the migration had already been applied in the 12:17 ET promote.
