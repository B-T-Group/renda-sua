# Stuck decline refunds

Use this when a Mobile Money decline refund stays `refund_pending` and the in-app actions return 409. The app credits the wallet only when the provider reports the payout failed, or when an admin override can prove the payout never left us.

Deploy Hasura migrations before the backend. If the backend ships first, an unguarded close uses the 12-argument function until `20261120170000` is applied. A guarded override does not credit on that old function. `DATABASE_URL` must reach the Rendasua database. Without it, decline returns 503 and changes nothing. The booking lock does not stay open during the provider call.

## What the app will not do

- `unpaid` and `failed` return 409 unless the provider lookup for this booking's reference is FAILED.
- `manual_override` returns 409 when the row has a provider reference, `refund_sent_at`, or `refund_send_attempted_at`, or when the lookup is unknown, still pending, or successful. It claims the row before that lookup. Any send stamp, including one older than this request, a provider reference, or a changed attempt count returns 409, restores the attempt count and the next retry time, and releases the claim. The wallet credit requires the claim token, a null send stamp, and an empty provider reference.
- `refunded` returns 409 unless the provider reports SUCCESS for this booking's own reference.
- FreemoPay is not sent a second time after a 404. A crash after the sent stamp, and a #840 row that already has a stable reference, stay parked.

Those rows need this procedure. Do not clear `refund_send_attempted_at`, `refund_sent_at`, or `refund_provider_ref` in the database to make the override pass.

## Check the provider

1. Open the booking in admin and copy `refund_provider`, `refund_provider_ref`, `refund_sent_at`, and `refund_send_attempted_at`.
2. Search the provider dashboard with that provider's key:
   - FedaPay: custom metadata external id `rental-decline-<booking id>`.
   - MTN: X-Reference-Id. That is the stable refund UUID, not the booking id. Copy it from `refund_provider_ref` when the reference is that UUID. When the row has no reference, derive it from the booking id. It is the SHA-256 of `rental-decline:<booking id>`, formatted as a UUID (version nibble `4`, variant nibble `a`):

     ```bash
     python3 -c "import hashlib,sys; b=sys.argv[1]; h=hashlib.sha256(('rental-decline:'+b).encode()).hexdigest(); print('-'.join([h[0:8],h[8:12],'4'+h[13:16],'a'+h[17:20],h[20:32]]))" BOOKING_ID
     ```

   - FreemoPay: the stored `FP-` reference. When none is stored, search the same stable refund UUID.
3. Record what the dashboard shows: success, failed, pending, or no payout. Keep a screenshot with the booking number.

A row with a send-attempt marker and no provider reference is resent by the refund cron. Wait one cron cycle before escalating that row.

FedaPay shows a pending payout for the booking (created, never sent): send that payout from the dashboard only while the booking row is still `refund_pending`. Do not create another payout and do not credit the wallet. An exhausted FedaPay row with no provider reference is checked about once an hour, so that dashboard send closes the row within about an hour, including a row that has a send-attempt marker and no send attempts left. The poll looks up `rental-decline-<booking id>`. If the row is already closed (`failed` and the wallet credited, or `refunded`), cancel that payout in FedaPay and escalate. Do not send it. If another payout for the same external id is already sent or approved, cancel the extra pending payout. Do not send it.

A FedaPay row with a send-attempt marker and no provider reference stays pending through a lookup outage. An unknown lookup does not use up the five send attempts. Retries wait 60 seconds and then double, up to 30 minutes. After 10 unknown lookups in a row (or the configured threshold), support gets one manual-check notice, and not another for that row for 24 hours. After finance sends the payout from the dashboard, the hourly poll closes the row as refunded. Do not credit the wallet for that row.

## Then

- Dashboard says the payout **failed**: an admin with `platform.financial.refunds` uses `failed` (or `unpaid`). The app probes again and credits the wallet only when that probe is FAILED. The audit row is written in the same transaction as the credit.
- Dashboard shows **no payout**, and the row has **no** reference, **no** sent stamp, and **no** send-attempt marker: an admin with `platform.financial.refunds.manual_override` uses `manual_override` and a note that quotes the dashboard. FedaPay must confirm external id `rental-decline-<booking id>` is absent. MTN accepts a 404 on the stable X-Reference-Id only when the attempt is at least 10 minutes old.
- Anything else (reference present, attempt marker present, FreemoPay crash after the stamp, #840 legacy row, pending, unknown, or a 404 that the app will not treat as absent): do not credit in the app. Escalate with the booking number, the provider screenshot, and whether the renter was already paid outside the app. A database update is a finance action after that evidence, not a support shortcut.

## Before turning on decline refunds in prod

Do not enable the decline-refund flags in production until each of these is done.

- FedaPay sandbox: confirm whether listing payouts filters `custom_metadata.externalId` on the server, what a further page looks like, how long a payout takes to appear after create and after send, and the status strings for failed and canceled. Record the page shape: whether `meta` is always present, which keys it uses (`next_page`, `total_pages`, `per_page`), and the default page size. Set `rentals_fedapay_list_lag_minutes` and `rentals_fedapay_list_confirm_minutes` with a clear margin above the worst list lag measured there, between 10 minutes and 24 hours. Before any production promote of this change, including one with the decline flags still off, confirm an ordinary FedaPay wallet withdrawal still creates a payout.
- MTN sandbox: confirm an X-Reference-Id resend, the 409 on a duplicate reference, and a forced timeout after the provider has accepted the request.
- FreemoPay sandbox: confirm lookup by the stable external id, and a forced timeout after the provider has accepted the request.
- DEV soak with the flags on: payouts in the provider dashboards match the `refund_pending` rows, and no `refund_pending` row is older than its retry window.
- Alerts: age of `refund_pending` rows, unknown-lookup streaks, manual-check and exhausted counts, more than one payout for the same external id, and FedaPay `Payout.all` volume per booking.
- The lag and confirm keys are locked between 10 minutes and 24 hours by a database check, the admin endpoint, and the code. The unknown-notice count is locked between 1 and 100. Only a superuser can insert, update, rename, or delete those keys. `platform.config.application` is not enough. A rename onto a key that already exists returns 409. A global key cannot be inserted twice. Migration `20261120160000` deletes inactive duplicates of those three keys only when exactly one active row exists. More than one active row fails the migration. With no active row it keeps the most recently updated row and stops if that choice is tied. It does not delete other global keys. The refund config read orders by updated_at descending with nulls last, then created_at, then id. An all-dead FedaPay list credits only after the latest send stamp is older than the lag window. The send stamp is written before create and before sendNow, so a lost reply still counts. The lookup and the withdrawal each get 20 list calls for the first walk and 20 more for the confirming walk, and they share one 100 second deadline per tick. A stored tick past that deadline is replaced, and a manual override lists on its own tick, so a live cron tick keeps its deadline and its list budgets. A retrieve or sendNow is skipped when fewer than 25 seconds remain before the two-minute claim. A lookup that runs out of calls or time increases the unknown streak.
- Finance and support have walked this runbook: a duplicate payout is canceled and not sent, an exhausted row with no payout stays a 409 for finance to act on, and a dashboard send on an exhausted FedaPay row closes within about an hour.
