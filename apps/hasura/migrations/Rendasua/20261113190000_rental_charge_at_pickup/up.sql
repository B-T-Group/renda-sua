-- Charge the rental at pickup and hold only the deposit for inspected Stripe bookings.
-- v1 flag stays false. Dev is turned on by hand. Production stays off.
-- Legacy card rentals stay on the booking-time hold. Phase 2 can add its own flag.

ALTER TYPE public.rental_booking_payment_status_enum ADD VALUE IF NOT EXISTS 'deposit_held';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS card_payment_mode text,
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS previous_deposit_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_capture_before timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_hold_amount numeric(18, 2),
  ADD COLUMN IF NOT EXISTS deposit_renewal_status text,
  ADD COLUMN IF NOT EXISTS deposit_renewal_reason text,
  ADD COLUMN IF NOT EXISTS deposit_renewal_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_renewal_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_renewal_escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS renewal_intent_attempt integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS pickup_charge_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charged_attempt integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS pickup_payment_failure_code text,
  ADD COLUMN IF NOT EXISTS pickup_payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS remainder_amount numeric(18, 2),
  ADD COLUMN IF NOT EXISTS remainder_status text,
  ADD COLUMN IF NOT EXISTS remainder_overtime_covered numeric(18, 2),
  ADD COLUMN IF NOT EXISTS remainder_damage_covered numeric(18, 2),
  ADD COLUMN IF NOT EXISTS remainder_invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS remainder_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS remainder_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS remainder_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_settled_at timestamptz;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_card_payment_mode_check;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_card_payment_mode_check
  CHECK (
    card_payment_mode IS NULL
    OR card_payment_mode IN ('authorize_upfront', 'charge_at_pickup')
  );

COMMENT ON COLUMN public.rental_bookings.card_payment_mode IS
  'authorize_upfront keeps today''s booking-time hold. charge_at_pickup saves a card, charges the contract at pickup, and holds only the deposit.';

COMMENT ON COLUMN public.rental_bookings.previous_deposit_payment_intent_id IS
  'Deposit PaymentIntent replaced by a renewal. Kept so a crash between the new auth and the cancel is visible.';

COMMENT ON COLUMN public.rental_bookings.deposit_capture_before IS
  'Stripe charge.payment_method_details.card.capture_before for the current deposit hold. Not a hardcoded 6 or 7 days.';

CREATE TABLE IF NOT EXISTS public.rental_card_money_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  leg text NOT NULL,
  stripe_id text,
  amount numeric(18, 2),
  currency text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_card_money_events_key_unique UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS rental_card_money_events_booking_idx
  ON public.rental_card_money_events (booking_id);

COMMENT ON TABLE public.rental_card_money_events IS
  'Idempotency ledger for charge-at-pickup webhooks and sweeps. event_key is unique. No card numbers.';

CREATE TABLE IF NOT EXISTS public.rental_support_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_support_alerts_booking_kind_unique UNIQUE (booking_id, kind)
);

CREATE INDEX IF NOT EXISTS rental_bookings_deposit_renewal_idx
  ON public.rental_bookings (deposit_capture_before)
  WHERE card_payment_mode = 'charge_at_pickup'
    AND deposit_settled_at IS NULL
    AND deposit_payment_intent_id IS NOT NULL;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_card_charge_at_pickup_enabled',
  'Charge inspected card rentals at pickup',
  'Inspected Stripe-rail bookings save a card after accept and are charged at pickup, with a deposit-only hold. Read only from application_configurations. Global row. Default false. Do not enable in production from a migration.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag', 'payments']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_card_charge_at_pickup_enabled' AND country_code IS NULL
);

