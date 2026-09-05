# Representative compensation

Event-driven ledger for agent/business onboarding rewards. Credits are
idempotent (`representative_compensation_events` unique indexes + wallet
`reference_id`) and use the existing country/currency map (`XAF` for CM/GA,
`CAD` for CA).

## Rules

1. Agent referred a business, ≥10 approved items, and **cumulative completed
   sales of at least 2,500 XAF** (any positive sale in CAD) **within 30 days
   of onboarding** (`businesses.created_at`) → **7,500 XAF / $25 CAD once**
   per referred business.
2. **1% of merchandise subtotal** on **every** completed sale of that business,
   **including** the sale that paid the 7,500. No 30-day cap on 1%.
3. If the in-window sales total never reaches the market minimum (2,500 XAF;
   any positive sale in CAD) by day 30, the 7,500 is never paid; 1% still
   pays on completed sales.
4. Business referred another business that reaches 10 approved items → 1,000
   XAF / $10 CAD (catalog-only; no order).
5. Agent referred another agent (existing first-delivery hook) → 1,000 XAF /
   $10 CAD.

A legacy `business_referral_payouts` row counts as the 7,500 already paid.

Uniqueness: 7,500 once per business (`uq_rce_business_onboarding_rule`); 1%
once per order (`uq_rce_order_sale_percent`). Both can exist on the same order.

Completed sale = `orders.current_status` in `complete` / `delivered`.
Approved item = `status = active`, `is_active`, `moderation_status = approved`.
Cutoff remains `2026-04-01`. Master flag: `business_referral_payout_enabled`.

## Triggers

- Order complete/delivered: insert pending `onboarding_10_first_sale` when
  the 10-item + window/sales bar is met; **credit 1% immediately**.
- Item approved (admin, AI, merchant accept-proposal): B2B 10-item credit
  immediately; agent 7,500 is claimed as `pending` if a qualifying sale already
  exists.
- Saturday job (`runWeeklyPayouts` → `sweepPending`): wallet-credits **only**
  pending or failed `onboarding_10_first_sale` rows and sets them to `credited`.
  It does not re-evaluate sales or pay 1%. Missed or failed 1% is retried on
  the next weekday sale for that business.
