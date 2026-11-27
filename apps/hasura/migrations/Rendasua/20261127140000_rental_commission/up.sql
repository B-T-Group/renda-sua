-- Rental commission. Rules table, per-booking snapshot, and audit rows.
-- The commission is charged to the merchant on the rental subtotal. The renter pays no fee.
-- Money is stored as NUMERIC(18,2). Rates are whole basis points (1500 = 15%).

CREATE TABLE IF NOT EXISTS public.rental_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('default', 'country', 'category', 'merchant', 'promo')),
  business_id UUID REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  rental_category_id UUID REFERENCES public.rental_categories(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  country_code VARCHAR(2),
  campaign_code TEXT,
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  reason TEXT,
  created_by UUID REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rental_commission_rules_window CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT rental_commission_rules_scope_keys CHECK (
    (scope = 'default' AND business_id IS NULL AND rental_category_id IS NULL AND country_code IS NULL AND campaign_code IS NULL)
    OR (scope = 'country' AND country_code IS NOT NULL AND business_id IS NULL AND rental_category_id IS NULL AND campaign_code IS NULL)
    OR (scope = 'category' AND rental_category_id IS NOT NULL AND business_id IS NULL AND campaign_code IS NULL)
    OR (scope = 'merchant' AND business_id IS NOT NULL AND rental_category_id IS NULL AND country_code IS NULL AND campaign_code IS NULL)
    OR (scope = 'promo' AND business_id IS NOT NULL AND campaign_code IS NOT NULL AND rental_category_id IS NULL AND country_code IS NULL)
  )
);

CREATE TRIGGER set_public_rental_commission_rules_updated_at
  BEFORE UPDATE ON public.rental_commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- One open-ended active rule per scope key. Bounded rules are checked by the admin API.
CREATE UNIQUE INDEX IF NOT EXISTS rental_commission_rules_open_key
  ON public.rental_commission_rules (
    scope,
    COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(rental_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(country_code, ''),
    COALESCE(campaign_code, '')
  )
  WHERE status = 'active' AND effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rental_commission_rules_promo_once
  ON public.rental_commission_rules (business_id, campaign_code)
  WHERE scope = 'promo';

CREATE INDEX IF NOT EXISTS rental_commission_rules_lookup
  ON public.rental_commission_rules (scope, status, effective_from);

COMMENT ON TABLE public.rental_commission_rules IS
  'Rental commission rates in basis points. Never edited in place: end the old rule and create a new one. Bookings snapshot the resolved rate at merchant accept.';

INSERT INTO public.rental_commission_rules (scope, rate_bps, reason)
SELECT 'default', 1500, 'Launch default: 15% of the rental subtotal, charged to the merchant'
WHERE NOT EXISTS (
  SELECT 1 FROM public.rental_commission_rules WHERE scope = 'default' AND status = 'active' AND effective_to IS NULL
);

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS commission_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (commission_status IN ('not_applicable', 'quoted', 'earned', 'reversed', 'waived')),
  ADD COLUMN IF NOT EXISTS commission_rate_bps INTEGER CHECK (commission_rate_bps BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS commission_basis TEXT,
  ADD COLUMN IF NOT EXISTS commission_base_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS merchant_payout_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS commission_rounding TEXT,
  ADD COLUMN IF NOT EXISTS commission_rule_id UUID REFERENCES public.rental_commission_rules(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_source TEXT,
  ADD COLUMN IF NOT EXISTS commission_campaign_code TEXT,
  ADD COLUMN IF NOT EXISTS commission_calc_version INTEGER,
  ADD COLUMN IF NOT EXISTS commission_quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_earned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_earned_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS commission_reversed_amount NUMERIC(18,2);

COMMENT ON COLUMN public.rental_bookings.commission_status IS
  'not_applicable (legacy or flag off), quoted (frozen at merchant accept), earned (settled at return), reversed, waived (cancelled, declined or expired before return).';

CREATE OR REPLACE FUNCTION public.rental_booking_waive_commission()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.commission_status = 'quoted' THEN
    NEW.commission_status := 'waived';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rental_booking_waive_commission ON public.rental_bookings;
CREATE TRIGGER rental_booking_waive_commission
  BEFORE UPDATE OF status ON public.rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.rental_booking_waive_commission();

CREATE INDEX IF NOT EXISTS idx_rental_bookings_commission_status
  ON public.rental_bookings (commission_status)
  WHERE commission_status <> 'not_applicable';

ALTER TABLE public.commission_payouts
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS rental_booking_id UUID REFERENCES public.rental_bookings(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS commission_rate_bps INTEGER;

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;
ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal',
    'platform_funded_delivery',
    'service_fee',
    'rental_commission',
    'rental_merchant_payout'
  ));

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_one_parent;
ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_one_parent CHECK (num_nonnulls(order_id, rental_booking_id) = 1);

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_rental_booking_type_key;
ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_rental_booking_type_key UNIQUE (rental_booking_id, commission_type);

CREATE INDEX IF NOT EXISTS idx_commission_payouts_rental_booking_id
  ON public.commission_payouts (rental_booking_id);

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, boolean_value, number_value, date_value, min_value, max_value,
   country_code, tags, status, version)
SELECT v.k, v.n, v.d, v.t, v.b, v.num, v.dt, v.mn, v.mx, NULL, ARRAY['rentals', 'commission']::text[], 'active', 1
FROM (VALUES
  ('rentals_commission_enabled', 'Rental commission',
   'When true, Rendasua takes its commission from the merchant on each rental accepted after this is on. The rate is frozen on the booking at accept. Country row wins over the global row. Default false. Turn on per environment by hand.',
   'boolean', false, NULL::numeric, NULL::timestamptz, NULL::numeric, NULL::numeric),
  ('rental_commission_early_adopter_rate_bps', 'Rental commission early-adopter rate (bps)',
   'Promo rate in basis points for early-adopter merchants. 1000 = 10%.',
   'number', NULL, 1000, NULL, 0, 10000),
  ('rental_commission_early_adopter_months', 'Rental commission early-adopter months',
   'How many months the early-adopter rate lasts after enrolment.',
   'number', NULL, 6, NULL, 1, 36),
  ('rental_commission_early_adopter_enrol_until', 'Rental commission early-adopter enrolment end',
   'Merchants whose first rental is accepted before this date are enrolled in the early-adopter promo.',
   'date', NULL, NULL, now() + interval '90 days', NULL, NULL)
) AS v(k, n, d, t, b, num, dt, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
  WHERE c.config_key = v.k AND c.country_code IS NULL
);

INSERT INTO public.rental_commission_rules
  (scope, business_id, campaign_code, rate_bps, effective_from, effective_to, reason)
SELECT DISTINCT 'promo', i.business_id, 'early_adopter_2026', 1000, now(), now() + interval '6 months',
  'Early-adopter promo at launch'
FROM public.rental_items i
ON CONFLICT DO NOTHING;
