-- Reserve now, pay at pickup (Samuel, 26 Nov 2026 2:59 PM ET).
--
-- * Card markets: when rentals_card_charge_at_pickup_enabled is on at the moment the
--   proposed booking is created, card_pay_at_pickup is stamped true. Reserve then
--   authorizes nothing; the card hold (rental - fee + deposit) is placed at Pay and
--   start, after the renter accepts the item check. Bookings created before (false)
--   keep authorizing at reserve. The flag is never re-read for a booking.
-- * Reservation fee: optional per listing (reservation_fee_enabled, off by default).
--   Flat 1.00 on the Stripe rail or 150 FCFA on Mobile Money, capped at the total. Snapshotted
--   on the booking at creation (reservation_fee_amount). It counts toward the total.
--   Status reuses order_deposit_status_enum:
--   none / pending / paid (held in the renter wallet) / applied (counted at settlement)
--   / forfeited (kept by the business) / refunded / failed.
-- * A rental can only become active from confirmed when it is paid or authorized.
--   This is a trigger, not a rewrite of rental_mark_started, so it composes with
--   20261126213000_rental_early_start_return_due (#881) in either order.
-- No status enum change. No backfill. Additive and idempotent.

ALTER TABLE public.rental_location_listings
  ADD COLUMN IF NOT EXISTS reservation_fee_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rental_location_listings.reservation_fee_enabled IS
  'Charge a reservation fee at Reserve: flat 1.00 on the Stripe rail or 150 FCFA on Mobile Money, capped at the rental, counts toward the total. Off by default.';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS card_pay_at_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservation_fee_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_fee_status public.order_deposit_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reservation_fee_ref uuid,
  ADD COLUMN IF NOT EXISTS reservation_fee_rail text,
  ADD COLUMN IF NOT EXISTS reservation_fee_settled_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rental_bookings_reservation_fee_nonneg'
  ) THEN
    ALTER TABLE public.rental_bookings
      ADD CONSTRAINT rental_bookings_reservation_fee_nonneg
      CHECK (reservation_fee_amount >= 0 AND reservation_fee_amount <= total_amount);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rental_bookings_reservation_fee_rail_check'
  ) THEN
    ALTER TABLE public.rental_bookings
      ADD CONSTRAINT rental_bookings_reservation_fee_rail_check
      CHECK (reservation_fee_rail IS NULL OR reservation_fee_rail IN ('card', 'wallet', 'mobile_money'));
  END IF;
END $$;

COMMENT ON COLUMN public.rental_bookings.card_pay_at_pickup IS
  'Card (Stripe) booking created while rentals_card_charge_at_pickup_enabled was on: nothing authorized at reserve, rental - fee + deposit authorized at Pay and start.';
COMMENT ON COLUMN public.rental_bookings.reservation_fee_amount IS
  'Reservation fee snapshot at booking creation. 0 = no fee. Counts toward total_amount.';
COMMENT ON COLUMN public.rental_bookings.reservation_fee_status IS
  'none / pending / paid (held in the renter wallet) / applied (counted in settlement) / forfeited (kept by the business) / refunded / failed.';
COMMENT ON COLUMN public.rental_bookings.reservation_fee_ref IS
  'Ledger reference for the fee hold, release and payment (one per booking).';
COMMENT ON COLUMN public.rental_bookings.reservation_fee_rail IS
  'How the fee was paid: card (Stripe, refunds to the card), wallet, or mobile_money (refunds to the wallet).';

-- Possession before payment is impossible: confirmed -> active needs a paid or
-- authorized booking. Legacy paths already stamp paid/authorized before the start.
CREATE OR REPLACE FUNCTION public.rental_bookings_require_paid_start()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status::text = 'active'
     AND OLD.status::text = 'confirmed'
     AND COALESCE(NEW.payment_status::text, '') NOT IN ('authorized', 'paid') THEN
    RAISE EXCEPTION 'rental_start_unpaid'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_bookings_require_paid_start ON public.rental_bookings;
CREATE TRIGGER rental_bookings_require_paid_start
  BEFORE UPDATE OF status ON public.rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.rental_bookings_require_paid_start();
