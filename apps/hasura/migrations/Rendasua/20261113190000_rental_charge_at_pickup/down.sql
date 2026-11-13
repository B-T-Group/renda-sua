DELETE FROM public.application_configurations
WHERE config_key IN (
  'rentals_card_charge_at_pickup_enabled'
) AND country_code IS NULL;

DROP TABLE IF EXISTS public.rental_support_alerts;
DROP TABLE IF EXISTS public.rental_card_money_events;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_card_payment_mode_check;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS deposit_settled_at,
  DROP COLUMN IF EXISTS remainder_reminded_at,
  DROP COLUMN IF EXISTS remainder_payment_intent_id,
  DROP COLUMN IF EXISTS remainder_paid_at,
  DROP COLUMN IF EXISTS remainder_invoiced_at,
  DROP COLUMN IF EXISTS remainder_damage_covered,
  DROP COLUMN IF EXISTS remainder_overtime_covered,
  DROP COLUMN IF EXISTS remainder_status,
  DROP COLUMN IF EXISTS remainder_amount,
  DROP COLUMN IF EXISTS pickup_payment_failure_reason,
  DROP COLUMN IF EXISTS pickup_payment_failure_code,
  DROP COLUMN IF EXISTS charged_attempt,
  DROP COLUMN IF EXISTS pickup_charge_attempt,
  DROP COLUMN IF EXISTS renewal_intent_attempt,
  DROP COLUMN IF EXISTS renewal_payment_intent_id,
  DROP COLUMN IF EXISTS deposit_renewal_escalated_at,
  DROP COLUMN IF EXISTS deposit_renewal_failed_at,
  DROP COLUMN IF EXISTS deposit_renewal_attempt,
  DROP COLUMN IF EXISTS deposit_renewal_reason,
  DROP COLUMN IF EXISTS deposit_renewal_status,
  DROP COLUMN IF EXISTS deposit_hold_amount,
  DROP COLUMN IF EXISTS deposit_capture_before,
  DROP COLUMN IF EXISTS deposit_payment_intent_id,
  DROP COLUMN IF EXISTS previous_deposit_payment_intent_id,
  DROP COLUMN IF EXISTS contract_payment_intent_id,
  DROP COLUMN IF EXISTS card_saved_at,
  DROP COLUMN IF EXISTS card_last4,
  DROP COLUMN IF EXISTS card_brand,
  DROP COLUMN IF EXISTS stripe_payment_method_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_setup_intent_id,
  DROP COLUMN IF EXISTS card_payment_mode;

-- deposit_held stays on the enum. Postgres cannot drop a value in place.
