# Representative compensation

Event-driven ledger for agent/business onboarding rewards. Credits are
idempotent (`representative_compensation_events` unique indexes + wallet
`reference_id`) and use the existing country/currency map (`XAF` for CM/GA,
`CAD` for CA).

## Rules

1. Agent onboarded a business, ≥10 approved items, ≥1 completed sale → 7,500 XAF / $25 CAD.
2. Same business, ≥25 items, a completed sale below 10,000 XAF / $25 CAD → 10,000 XAF / $40 CAD.
3. Same business, ≥25 items, a completed sale at or above that band (including above 25,000 XAF / $75 CAD) → 15,000 XAF / $50 CAD.
4. Completed sale that does not create or upgrade an onboarding milestone → 1% of order subtotal (no pyramid).
5. Business referred another business that reaches 10 approved items → 1,000 XAF / $10 CAD.
6. Agent referred another agent (existing first-delivery hook) → 1,000 XAF / $10 CAD.

Onboarding rewards 1–3 are a single ladder: pay the highest qualifying gross,
then only the difference on upgrades. Legacy `business_referral_payouts`
rows count as already paid.

Completed sale = `orders.current_status` in `complete` / `delivered`.
Approved item = `status = active`, `is_active`, `moderation_status = approved`.
Cutoff remains `2026-04-01`. Master flag: `business_referral_payout_enabled`.

## Triggers

- Order complete/delivered
- Item approved (admin, AI, merchant accept-proposal)
- Saturday job (`runWeeklyPayouts`) as an idempotent sweeper
