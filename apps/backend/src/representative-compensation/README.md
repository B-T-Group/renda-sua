# Representative compensation

Event-driven ledger for agent/business onboarding rewards. Credits are
idempotent (`representative_compensation_events` unique indexes + wallet
`reference_id`) and use the existing country/currency map (`XAF` for CM/GA,
`CAD` for CA).

## Rules

1. Agent referred a business, ≥2 approved items, and **cumulative completed
   sales of at least 2,500 XAF** (any positive sale in CAD) **within 30 days
   of onboarding** (`businesses.created_at`) → one `onboarding_x_first_sale`
   bonus per referred business. In XAF markets the bonus is **5,000** when the
   referring agent bought the sale that crossed the minimum, and **7,500** when
   someone else bought it. Canada is **$25** either way.
2. **1% of merchandise subtotal** on **every** completed sale of that business,
   **including** the sale that paid the bonus. No 30-day cap on 1%.
3. If the in-window sales total never reaches the market minimum (2,500 XAF;
   any positive sale in CAD) by day 30, the bonus is never paid; 1% still
   pays on completed sales.
4. Business referred another business that reaches 5 approved items → 1,000
   XAF / $10 CAD (catalog-only; no order).
5. Agent referred another agent (existing first-delivery hook) → 1,000 XAF /
   $10 CAD.

A legacy `business_referral_payouts` row counts as the onboarding bonus already paid.

The buyer is the referring agent when `orders.client.user_id` equals that
agent's `user_id`. The amount is locked on the sale that crosses the minimum.
A later customer purchase does not raise a 5,000 claim to 7,500.

Uniqueness: the bonus once per business (`uq_rce_business_onboarding_rule`); 1%
once per order (`uq_rce_order_sale_percent`). Both can exist on the same order.

Completed sale = `orders.current_status` in `complete` / `delivered`.
Approved item = `status = active`, `is_active`, `moderation_status = approved`.
Cutoff remains `2026-04-01`. Master flag: `business_referral_payout_enabled`.

## Triggers

- Order complete/delivered: insert pending `onboarding_x_first_sale` when
  the 2-item + window/sales bar is met; **credit 1% immediately**.
- Item approved (admin, AI, merchant accept-proposal): B2B 5-item credit
  immediately; the agent bonus is claimed as `pending` if a qualifying sale
  already exists.
- Saturday job (`runWeeklyPayouts` → `sweepPending`): wallet-credits **only**
  pending or failed `onboarding_x_first_sale` rows and sets them to `credited`.
  It does not re-evaluate sales or pay 1%. Missed or failed 1% is retried on
  the next weekday sale for that business.
