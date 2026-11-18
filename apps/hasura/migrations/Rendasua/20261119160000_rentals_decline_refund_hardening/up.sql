-- Follow-up for the decline refund claim. 20261119140000 is already applied on DEV.
-- SET LOCAL so lock_timeout does not stay on the pooled Hasura session.
SET LOCAL lock_timeout = '3s';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_notices text[];

COMMENT ON COLUMN public.rental_bookings.refund_sent_at IS
  'Stamped immediately before a FreemoPay withdrawal. Null means that payout was never sent.';
COMMENT ON COLUMN public.rental_bookings.refund_notices IS
  'Support outcomes already sent for this decline refund. Each outcome is sent once.';

-- The unique index from 20261119140000 fails if a booking already has two decline notes.
DROP INDEX IF EXISTS public.rental_status_history_one_decline;

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

CREATE UNIQUE INDEX rental_status_history_one_decline
  ON public.rental_status_history (rental_booking_id)
  WHERE notes = 'Renter declined the pickup condition';
