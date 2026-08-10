-- Migration: 20260809200000_business_launch_promo_slots
-- Description: Launch promo slots (0% item commission for first N orders for first M
--              businesses per non-stripe country) + application_configurations seeds.

CREATE TABLE public.business_launch_promo_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uq_business_launch_promo_slots_business_id UNIQUE (business_id),
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'confirmed', 'released')),
  orders_remaining int NOT NULL CHECK (orders_remaining >= 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL,
  released_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_launch_promo_slots IS
  'Tracks 0% item-commission launch promo slots claimed by early businesses per country.';
COMMENT ON COLUMN public.business_launch_promo_slots.status IS
  'claimed = signup held slot; confirmed = identified/active; released = expired unused slot.';
COMMENT ON COLUMN public.business_launch_promo_slots.orders_remaining IS
  'Settled orders still eligible for 0% item commission.';

CREATE INDEX idx_business_launch_promo_slots_country_status
  ON public.business_launch_promo_slots (country_code, status);

CREATE INDEX idx_business_launch_promo_slots_claimed_status
  ON public.business_launch_promo_slots (claimed_at)
  WHERE status = 'claimed';

CREATE TRIGGER set_public_business_launch_promo_slots_updated_at
  BEFORE UPDATE ON public.business_launch_promo_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Atomic claim: advisory-lock per country, respect configured limit, return slot or empty.
CREATE OR REPLACE FUNCTION public.claim_business_launch_promo_slot(
  p_business_id uuid,
  p_country_code text
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  country_code text,
  status text,
  orders_remaining int,
  claimed_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_country text := UPPER(TRIM(COALESCE(p_country_code, '')));
  v_limit numeric;
  v_orders int;
  v_used int;
  v_existing public.business_launch_promo_slots%ROWTYPE;
BEGIN
  IF p_business_id IS NULL OR v_country = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM public.business_launch_promo_slots s
  WHERE s.business_id = p_business_id;

  IF FOUND AND v_existing.status IN ('claimed', 'confirmed') THEN
    id := v_existing.id;
    business_id := v_existing.business_id;
    country_code := v_existing.country_code;
    status := v_existing.status;
    orders_remaining := v_existing.orders_remaining;
    claimed_at := v_existing.claimed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Released slots keep the unique business_id row; do not re-claim.
  IF FOUND AND v_existing.status = 'released' THEN
    RETURN;
  END IF;

  SELECT c.number_value INTO v_limit
  FROM public.application_configurations c
  WHERE c.config_key = 'launch_promo_business_limit'
    AND c.country_code = v_country
    AND c.status = 'active'
  LIMIT 1;

  SELECT c.number_value INTO v_orders
  FROM public.application_configurations c
  WHERE c.config_key = 'launch_promo_zero_commission_orders'
    AND c.country_code = v_country
    AND c.status = 'active'
  LIMIT 1;

  IF v_limit IS NULL OR v_limit <= 0 OR v_orders IS NULL OR v_orders <= 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('launch_promo:' || v_country));

  SELECT COUNT(*)::int INTO v_used
  FROM public.business_launch_promo_slots s
  WHERE s.country_code = v_country
    AND s.status IN ('claimed', 'confirmed');

  IF v_used >= v_limit::int THEN
    RETURN;
  END IF;

  INSERT INTO public.business_launch_promo_slots (
    business_id, country_code, status, orders_remaining
  ) VALUES (
    p_business_id, v_country, 'claimed', v_orders::int
  )
  RETURNING
    public.business_launch_promo_slots.id,
    public.business_launch_promo_slots.business_id,
    public.business_launch_promo_slots.country_code,
    public.business_launch_promo_slots.status,
    public.business_launch_promo_slots.orders_remaining,
    public.business_launch_promo_slots.claimed_at
  INTO id, business_id, country_code, status, orders_remaining, claimed_at;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.claim_business_launch_promo_slot(uuid, text) IS
  'Atomically claim a launch promo slot for a business in a country if under the configured cap.';

-- One consumption row per settled order (idempotent retries).
CREATE TABLE public.business_launch_promo_consumptions (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.business_launch_promo_slots(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_launch_promo_consumptions_business_id
  ON public.business_launch_promo_consumptions (business_id);

-- Consume one promo order at settlement time (idempotent per order_id).
CREATE OR REPLACE FUNCTION public.consume_business_launch_promo_order(
  p_business_id uuid,
  p_order_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  orders_remaining int,
  status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.business_launch_promo_consumptions%ROWTYPE;
  v_slot public.business_launch_promo_slots%ROWTYPE;
BEGIN
  IF p_business_id IS NULL OR p_order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM public.business_launch_promo_consumptions c
  WHERE c.order_id = p_order_id;

  IF FOUND THEN
    SELECT * INTO v_slot
    FROM public.business_launch_promo_slots s
    WHERE s.id = v_existing.slot_id;
    IF FOUND THEN
      id := v_slot.id;
      business_id := v_slot.business_id;
      orders_remaining := v_slot.orders_remaining;
      status := v_slot.status;
      RETURN NEXT;
    END IF;
    RETURN;
  END IF;

  UPDATE public.business_launch_promo_slots s
  SET orders_remaining = s.orders_remaining - 1,
      updated_at = now()
  WHERE s.business_id = p_business_id
    AND s.orders_remaining > 0
    AND (
      s.status = 'confirmed'
      OR (
        s.status = 'claimed'
        AND s.claimed_at >= now() - make_interval(
          days => COALESCE(
            (
              SELECT c.number_value::int
              FROM public.application_configurations c
              WHERE c.config_key = 'launch_promo_identification_window_days'
                AND c.country_code = s.country_code
                AND c.status = 'active'
              LIMIT 1
            ),
            30
          )
        )
      )
    )
  RETURNING s.id, s.business_id, s.orders_remaining, s.status
  INTO id, business_id, orders_remaining, status;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.business_launch_promo_consumptions (
    order_id, business_id, slot_id
  ) VALUES (
    p_order_id, p_business_id, id
  );

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.consume_business_launch_promo_order(uuid, uuid) IS
  'Atomically consume one launch-promo order for a business; idempotent per order_id.';

-- Undo a consumption when settlement fails after consume.
CREATE OR REPLACE FUNCTION public.restore_business_launch_promo_order(
  p_business_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF p_business_id IS NULL OR p_order_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.business_launch_promo_consumptions c
  WHERE c.order_id = p_order_id
    AND c.business_id = p_business_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN;
  END IF;

  UPDATE public.business_launch_promo_slots s
  SET orders_remaining = s.orders_remaining + 1,
      updated_at = now()
  WHERE s.business_id = p_business_id
    AND s.status IN ('claimed', 'confirmed');
END;
$$;

-- Seed configs for CM and GA (non-stripe markets)
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'launch_promo_business_limit',
    'Launch Promo Business Limit (Cameroon)',
    'Max businesses that can claim the 0% commission launch promo in Cameroon.',
    'number', 150.00, 'CM',
    ARRAY['business', 'launch', 'promo', 'commission'],
    'active'
  ),
  (
    'launch_promo_zero_commission_orders',
    'Launch Promo Zero Commission Orders (Cameroon)',
    'Number of settled orders with 0% item commission for launch promo businesses in Cameroon.',
    'number', 15.00, 'CM',
    ARRAY['business', 'launch', 'promo', 'commission'],
    'active'
  ),
  (
    'launch_promo_identification_window_days',
    'Launch Promo Identification Window Days (Cameroon)',
    'Days after signup to reach lifecycle active before a claimed launch promo slot is released.',
    'number', 30.00, 'CM',
    ARRAY['business', 'launch', 'promo'],
    'active'
  ),
  (
    'launch_promo_business_limit',
    'Launch Promo Business Limit (Gabon)',
    'Max businesses that can claim the 0% commission launch promo in Gabon.',
    'number', 150.00, 'GA',
    ARRAY['business', 'launch', 'promo', 'commission'],
    'active'
  ),
  (
    'launch_promo_zero_commission_orders',
    'Launch Promo Zero Commission Orders (Gabon)',
    'Number of settled orders with 0% item commission for launch promo businesses in Gabon.',
    'number', 15.00, 'GA',
    ARRAY['business', 'launch', 'promo', 'commission'],
    'active'
  ),
  (
    'launch_promo_identification_window_days',
    'Launch Promo Identification Window Days (Gabon)',
    'Days after signup to reach lifecycle active before a claimed launch promo slot is released.',
    'number', 30.00, 'GA',
    ARRAY['business', 'launch', 'promo'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO NOTHING;
