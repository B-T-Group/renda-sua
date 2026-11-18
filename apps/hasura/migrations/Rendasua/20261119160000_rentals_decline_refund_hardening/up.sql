-- Follow-up for the decline refund claim. 20261119140000 is already applied on DEV.
-- SET LOCAL so lock_timeout does not stay on the pooled Hasura session.
-- Do not DROP the live unique index. On DEV it already forbids duplicates.
SET LOCAL lock_timeout = '3s';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_credited_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_notices jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.rental_bookings.refund_sent_at IS
  'Stamped immediately before a FreemoPay withdrawal. Null means that payout was never sent.';
COMMENT ON COLUMN public.rental_bookings.refund_credited_at IS
  'Set when the decline payout is put back in the wallet, even if the status write loses its claim.';
COMMENT ON COLUMN public.rental_bookings.refund_notices IS
  'Support outcomes already claimed for this decline refund. jsonb so Hasura _append and _contains work.';

-- Existing FreemoPay rows kept the stable id and a null sent stamp, so the cron would pay again.
UPDATE public.rental_bookings
SET refund_sent_at = COALESCE(refund_status_at, refund_claim_at, now())
WHERE refund_status = 'refund_pending'
  AND lower(COALESCE(refund_provider, '')) = 'freemopay'
  AND refund_sent_at IS NULL
  AND (
    refund_provider_ref IS NOT NULL
    OR refund_attempts > 0
    OR refund_claim_at IS NOT NULL
  );

-- Delete duplicates first. Where 20261119140000 already created the index, this changes nothing.
DELETE FROM public.rental_status_history
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      row_number() OVER (
        PARTITION BY rental_booking_id
        ORDER BY created_at ASC, id ASC
      ) AS n
    FROM public.rental_status_history
    WHERE notes = 'Renter declined the pickup condition'
  ) ranked
  WHERE ranked.n > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_status_history_one_decline
  ON public.rental_status_history (rental_booking_id)
  WHERE notes = 'Renter declined the pickup condition';
