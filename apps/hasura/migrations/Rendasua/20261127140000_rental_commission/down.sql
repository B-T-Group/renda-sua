DELETE FROM public.commission_payouts WHERE rental_booking_id IS NOT NULL;

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_rental_booking_type_key,
  DROP CONSTRAINT IF EXISTS commission_payouts_one_parent,
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;

DROP INDEX IF EXISTS public.idx_commission_payouts_rental_booking_id;

ALTER TABLE public.commission_payouts
  DROP COLUMN IF EXISTS commission_rate_bps,
  DROP COLUMN IF EXISTS rental_booking_id,
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal',
    'platform_funded_delivery',
    'service_fee'
  ));

DROP TRIGGER IF EXISTS rental_booking_waive_commission ON public.rental_bookings;
DROP FUNCTION IF EXISTS public.rental_booking_waive_commission();

DROP INDEX IF EXISTS public.idx_rental_bookings_commission_status;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS commission_reversed_amount,
  DROP COLUMN IF EXISTS commission_earned_amount,
  DROP COLUMN IF EXISTS commission_earned_at,
  DROP COLUMN IF EXISTS commission_quoted_at,
  DROP COLUMN IF EXISTS commission_calc_version,
  DROP COLUMN IF EXISTS commission_campaign_code,
  DROP COLUMN IF EXISTS commission_source,
  DROP COLUMN IF EXISTS commission_rule_id,
  DROP COLUMN IF EXISTS commission_rounding,
  DROP COLUMN IF EXISTS merchant_payout_amount,
  DROP COLUMN IF EXISTS commission_amount,
  DROP COLUMN IF EXISTS commission_base_amount,
  DROP COLUMN IF EXISTS commission_basis,
  DROP COLUMN IF EXISTS commission_rate_bps,
  DROP COLUMN IF EXISTS commission_status;

DELETE FROM public.application_configurations
WHERE config_key IN (
  'rentals_commission_enabled',
  'rental_commission_early_adopter_rate_bps',
  'rental_commission_early_adopter_months',
  'rental_commission_early_adopter_enrol_until'
);

DROP TABLE IF EXISTS public.rental_commission_rules;
