# Representative compensation

Event-driven ledger for agent/business onboarding rewards. Credits are
idempotent (`representative_compensation_events` unique indexes + wallet
`reference_id`) and use the existing country/currency map (`XAF` for CM/GA,
`CAD` for CA).

## Rules

Each **onboarding type is paid once per referred business**, on a **new
completed order**. One order pays at most one commission (full amount, never
an upgrade delta).

1. Agent onboarded a business, ≥10 approved items, this completed sale → 7,500 XAF / $25 CAD.
2. Same business, ≥25 items, **another** completed sale below 10,000 XAF / $25 CAD → 10,000 XAF / $40 CAD.
3. Same business, ≥25 items, **another** completed sale at or above 10,000 XAF / $25 CAD → 15,000 XAF / $50 CAD.
4. Completed sale that does not unlock an unpaid onboarding type → 1% of order subtotal (no pyramid).
5. Business referred another business that reaches 10 approved items → 1,000 XAF / $10 CAD (catalog-only; no order).
6. Agent referred another agent (existing first-delivery hook) → 1,000 XAF / $10 CAD.

If the first sale already happens at 25+ items and is large, pay **only**
15,000. The 7,500 and 10,000 types remain available for later qualifying
orders. Reaching 25 products without a new sale pays nothing.

A legacy `business_referral_payouts` row counts as the 7,500 / 10-item
type already paid.

Completed sale = `orders.current_status` in `complete` / `delivered`.
Approved item = `status = active`, `is_active`, `moderation_status = approved`.
Cutoff remains `2026-04-01`. Master flag: `business_referral_payout_enabled`.

## Triggers

- Order complete/delivered (agent milestones and 1%)
- Item approved (admin, AI, merchant accept-proposal) — B2B 10-item only
- Saturday job (`runWeeklyPayouts`) as an idempotent sweeper over unpaid orders
