-- Does not remove 'manual' from the refund check, so manual rows stay valid.
-- Rolling back 20261119140000 maps those rows to failed before it restores the older check.
SET LOCAL lock_timeout = '3s';

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_notices,
  DROP COLUMN IF EXISTS refund_sent_at;
