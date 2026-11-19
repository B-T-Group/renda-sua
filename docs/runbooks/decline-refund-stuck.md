# Stuck decline refunds

Use this when a Mobile Money decline refund stays `refund_pending` and the in-app actions return 409. The app credits the wallet only when the provider reports the payout failed, or when an admin override can prove the payout never left us.

## What the app will not do

- `unpaid` and `failed` return 409 unless the provider lookup for this booking's reference is FAILED.
- `manual_override` returns 409 when the row has a provider reference, `refund_sent_at`, or `refund_send_attempted_at`, or when the lookup is unknown, still pending, or successful.
- `refunded` returns 409 unless the provider reports SUCCESS for this booking's own reference.
- FreemoPay is not sent a second time after a 404. A crash after the sent stamp, and a #840 row that already has a stable reference, stay parked.

Those rows need this procedure. Do not clear `refund_send_attempted_at`, `refund_sent_at`, or `refund_provider_ref` in the database to make the override pass.

## Check the provider

1. Open the booking in admin and copy `refund_provider`, `refund_provider_ref`, `refund_sent_at`, and `refund_send_attempted_at`.
2. Search the provider dashboard with that provider's key:
   - FedaPay: custom metadata external id `rental-decline-<booking id>`.
   - MTN: X-Reference-Id. That is the stable refund UUID, not the booking id. Copy it from `refund_provider_ref` when the reference is that UUID.
   - FreemoPay: the stored `FP-` reference. When none is stored, search the same stable refund UUID.
3. Record what the dashboard shows: success, failed, pending, or no payout. Keep a screenshot with the booking number.

A row with a send-attempt marker and no provider reference is resent by the refund cron. Wait one cron cycle before escalating that row.

## Then

- Dashboard says the payout **failed**: an admin with `platform.financial.refunds` uses `failed` (or `unpaid`). The app probes again and credits the wallet only when that probe is FAILED. The audit row is written in the same transaction as the credit.
- Dashboard shows **no payout**, and the row has **no** reference, **no** sent stamp, and **no** send-attempt marker: an admin with `platform.financial.refunds.manual_override` uses `manual_override` and a note that quotes the dashboard. FedaPay must confirm external id `rental-decline-<booking id>` is absent. MTN accepts a 404 on the stable X-Reference-Id only when the attempt is at least 10 minutes old.
- Anything else (reference present, attempt marker present, FreemoPay crash after the stamp, #840 legacy row, pending, unknown, or a 404 that the app will not treat as absent): do not credit in the app. Escalate with the booking number, the provider screenshot, and whether the renter was already paid outside the app. A database update is a finance action after that evidence, not a support shortcut.
