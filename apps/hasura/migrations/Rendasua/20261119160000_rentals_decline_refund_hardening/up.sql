-- Follow-up for the decline refund claim. 20261119140000 is already applied on DEV.
-- Its up.sql is not edited. 20261119135000 deletes duplicate decline-history rows
-- before that unique index, including on a database that has not applied 140000 yet.
-- This file repeats the delete so it still works on its own.
-- SET LOCAL so lock_timeout does not stay on the pooled Hasura session.
-- Do not DROP the live unique index. On DEV it already forbids duplicates.
-- This file also runs safely when 20261119140000 was never applied.
SET LOCAL lock_timeout = '3s';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_credited_at timestamptz;

-- A round-1 apply may have created refund_notices as text[]. Hasura _append needs jsonb.
DO $$
DECLARE
  kind text;
BEGIN
  SELECT udt_name INTO kind
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rental_bookings' AND column_name = 'refund_notices';
  IF kind = '_text' THEN
    ALTER TABLE public.rental_bookings ALTER COLUMN refund_notices DROP DEFAULT;
    ALTER TABLE public.rental_bookings
      ALTER COLUMN refund_notices TYPE jsonb USING to_jsonb(coalesce(refund_notices, '{}'::text[])),
      ALTER COLUMN refund_notices SET DEFAULT '[]'::jsonb,
      ALTER COLUMN refund_notices SET NOT NULL;
  ELSIF kind IS NULL THEN
    ALTER TABLE public.rental_bookings
      ADD COLUMN refund_notices jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.rental_bookings.refund_sent_at IS
  'Stamped immediately before a FreemoPay withdrawal. Null means that payout was never sent.';
COMMENT ON COLUMN public.rental_bookings.refund_credited_at IS
  'Set when the decline payout is put back in the wallet, even if the status write loses its claim.';
COMMENT ON COLUMN public.rental_bookings.refund_notices IS
  'Support outcomes already claimed for this decline refund. jsonb so Hasura _append and _contains work.';

-- Existing FreemoPay rows kept the stable id and a null sent stamp, so the cron would pay again.
-- refund_claim_at comes from 20261119140000. Skip that predicate when the column is absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rental_bookings' AND column_name = 'refund_claim_at'
  ) THEN
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
  ELSE
    UPDATE public.rental_bookings
    SET refund_sent_at = COALESCE(refund_status_at, now())
    WHERE refund_status = 'refund_pending'
      AND lower(COALESCE(refund_provider, '')) = 'freemopay'
      AND refund_sent_at IS NULL
      AND (refund_provider_ref IS NOT NULL OR refund_attempts > 0);
  END IF;
END $$;

-- Delete duplicates first. This is a no-op when the unique index already exists.
-- It also succeeds on a database that never applied 20261119140000.
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
