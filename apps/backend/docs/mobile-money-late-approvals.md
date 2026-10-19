# Mobile money: approvals that arrive after we marked a payment failed

FedaPay can send `transaction.approved` for a collection we had already marked failed
(declined, then the customer approved the same prompt). The callback processor never
trusts the webhook body: it re-reads the transaction from FedaPay and requires live
status `approved`, currency XOF, the stored amount and the stored reference.

| Row | What happens automatically | Row afterwards | Alert |
|---|---|---|---|
| Wallet top-up (`payment_entity` null or `account`) | Wallet credited once (`momo-deposit:<tx id>`) | `success` / `LATE_SUCCESS_APPLIED` | `late_success_wallet_credited` |
| Order, superseded or retry-terminal attempt | Wallet credited; first success pays the order, otherwise the money stays in the wallet | `success` / `LATE_SUCCESS_APPLIED` or `DUPLICATE_PAYMENT_CREDITED` | `duplicate_momo_collect` when duplicate |
| Order, plain failed attempt | Wallet credited; unpaid live order is paid with it, a cancelled/terminal or already-paid order is never reopened and the money stays in the wallet | `success` / `LATE_SUCCESS_APPLIED` or `DUPLICATE_PAYMENT_CREDITED` | `late_success_order_applied` or `duplicate_momo_collect` + `late_success_order_duplicate` |
| Any other entity (`order_deposit`, `claim_order`, rentals, business / reel-AI tokens, phone verification) | **Nothing is credited or applied.** | unchanged (`failed`) | `late_success_non_wallet` |
| Live record disagrees (amount, currency, reference, status) | Nothing is credited; webhook answered 409/422 | unchanged | `late_success_{top_up,order}_live_mismatch` |

## Finance runbook for `late_success_non_wallet` (L6)

The customer was charged but the entity was not paid. For each alert:

1. Open the FedaPay dashboard for the transaction id in the alert and confirm it is
   `approved` with the stored amount (XOF).
2. Look up the `mobile_payment_transactions` row (`transactionId` in the alert) and the
   entity (`entity` / `entityId`).
3. If the entity can still use the payment (for example the rental booking or token
   purchase is still open), apply it manually through the admin tools and set the row
   to `success` with an `error_message` noting the manual resolution.
4. Otherwise refund the customer: credit their wallet with an admin adjustment that
   references the transaction id, or refund through FedaPay, and record the refund on
   the row's `error_message`.
5. Never change a row to `success` without one of the two actions above.
