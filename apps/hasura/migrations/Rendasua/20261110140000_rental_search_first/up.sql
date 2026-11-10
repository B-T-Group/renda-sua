-- Search-first rentals. Additive: flag, trigram indexes, subscription + notice tables.
-- Safe to apply before the Nest endpoints. The flag stays off.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_search_first_enabled',
  'Rentals search-first',
  'Client rentals landing uses search, dates, and category icons instead of an item feed. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_search_first_enabled' AND country_code IS NULL
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS rental_items_name_trgm
  ON public.rental_items USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS rental_items_description_trgm
  ON public.rental_items USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS rental_categories_name_trgm
  ON public.rental_categories USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.rental_availability_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE,
  country_code text,
  state text,
  query_text text NOT NULL DEFAULT '',
  query_norm text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.rental_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notified_at timestamptz,
  notified_listing_id uuid REFERENCES public.rental_location_listings(id) ON UPDATE CASCADE ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_availability_subscriptions_time_check CHECK (end_at > start_at),
  CONSTRAINT rental_availability_subscriptions_status_check CHECK (
    status IN ('active', 'notified', 'expired', 'cancelled')
  )
);

COMMENT ON TABLE public.rental_availability_subscriptions IS
  'Tell-me-when-available for a rental search. One active row per user, query, category, and dates. Claimed once, then expired.';

CREATE UNIQUE INDEX IF NOT EXISTS rental_availability_subs_active_uidx
  ON public.rental_availability_subscriptions (
    user_id,
    query_norm,
    COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    start_at,
    end_at
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS rental_availability_subs_active_idx
  ON public.rental_availability_subscriptions (status, expires_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.rental_availability_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL UNIQUE REFERENCES public.rental_availability_subscriptions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.rental_location_listings(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT rental_availability_notices_status_check CHECK (
    status IN ('queued', 'sending', 'sent', 'failed')
  )
);

COMMENT ON TABLE public.rental_availability_notices IS
  'One delivery row per subscription. The trigger inserts it when the subscription is claimed. Nest sends push and the in-app message. WhatsApp is intentionally not sent.';

CREATE INDEX IF NOT EXISTS rental_availability_notices_queued_idx
  ON public.rental_availability_notices (created_at)
  WHERE status = 'queued';

INSERT INTO public.entity_types (id, comment)
VALUES ('rental_availability_alert', 'Client notice that a rental is free for saved dates')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment)
VALUES ('RENTAL_AVAILABLE', 'A watched rental search has a free listing')
ON CONFLICT (id) DO NOTHING;

-- Held capacity matches LIST_OVERLAPPING_BOOKING_WINDOWS / rental-capacity.ts:
-- reserved, confirmed, active, awaiting_return, and unexpired proposed.
-- rental_booking_units are inspection labels and are not counted.
CREATE OR REPLACE FUNCTION public.rental_peak_units_held(
  p_listing_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_now timestamptz
) RETURNS integer
LANGUAGE sql
STABLE
AS $$
  WITH windows AS (
    SELECT
      GREATEST(w.start_at, p_start) AS s,
      LEAST(w.end_at, p_end) AS e,
      GREATEST(COALESCE(b.units_booked, 1), 1) AS units
    FROM public.rental_booking_windows w
    JOIN public.rental_bookings b ON b.id = w.rental_booking_id
    WHERE b.rental_location_listing_id = p_listing_id
      AND w.start_at < p_end
      AND w.end_at > p_start
      AND (
        b.status::text IN ('reserved', 'confirmed', 'active', 'awaiting_return')
        OR (b.status::text = 'proposed' AND b.contract_expires_at > p_now)
      )
  ),
  events AS (
    SELECT s AS t, units AS delta FROM windows WHERE e > s
    UNION ALL
    SELECT e AS t, -units AS delta FROM windows WHERE e > s
  ),
  ordered AS (
    SELECT SUM(delta) OVER (ORDER BY t, delta) AS running
    FROM events
  )
  SELECT COALESCE(MAX(running), 0)::integer FROM ordered;
$$;

CREATE OR REPLACE FUNCTION public.rental_claim_availability_for_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
  v_category uuid;
  v_category_name text;
  v_country text;
  v_state text;
  v_units integer;
  v_sub record;
  v_peak integer;
BEGIN
  SELECT
    i.name,
    i.rental_category_id,
    c.name,
    a.country,
    a.state,
    l.units_available
  INTO v_name, v_category, v_category_name, v_country, v_state, v_units
  FROM public.rental_location_listings l
  JOIN public.rental_items i ON i.id = l.rental_item_id
  JOIN public.rental_categories c ON c.id = i.rental_category_id
  JOIN public.businesses biz ON biz.id = i.business_id
  JOIN public.business_locations bl ON bl.id = l.business_location_id
  LEFT JOIN public.addresses a ON a.id = bl.address_id
  WHERE l.id = p_listing_id
    AND l.is_active IS TRUE
    AND l.deleted_at IS NULL
    AND l.moderation_status = 'approved'
    AND i.is_active IS TRUE
    AND i.deleted_at IS NULL
    AND biz.is_storefront_visible IS TRUE
    AND bl.is_active IS TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_sub IN
    SELECT *
    FROM public.rental_availability_subscriptions s
    WHERE s.status = 'active'
      AND s.expires_at > now()
      AND (
        s.country_code IS NULL OR btrim(s.country_code) = ''
        OR lower(btrim(s.country_code)) = lower(btrim(COALESCE(v_country, '')))
      )
      AND (
        s.state IS NULL OR btrim(s.state) = ''
        OR lower(btrim(s.state)) = lower(btrim(COALESCE(v_state, '')))
      )
      AND (s.category_id IS NULL OR s.category_id = v_category)
      AND (
        s.query_norm = ''
        OR v_name ILIKE '%' || s.query_norm || '%'
        OR COALESCE(v_category_name, '') ILIKE '%' || s.query_norm || '%'
      )
  LOOP
    IF NOT public.rental_dates_open(p_listing_id, v_sub.start_at, v_sub.end_at) THEN
      CONTINUE;
    END IF;
    v_peak := public.rental_peak_units_held(p_listing_id, v_sub.start_at, v_sub.end_at, now());
    IF v_peak + 1 > GREATEST(COALESCE(v_units, 1), 1) THEN
      CONTINUE;
    END IF;
    UPDATE public.rental_availability_subscriptions
    SET status = 'notified',
        notified_at = now(),
        notified_listing_id = p_listing_id,
        updated_at = now()
    WHERE id = v_sub.id AND status = 'active';
    IF FOUND THEN
      INSERT INTO public.rental_availability_notices (subscription_id, user_id, listing_id)
      VALUES (v_sub.id, v_sub.user_id, p_listing_id)
      ON CONFLICT (subscription_id) DO NOTHING;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'rental availability claim failed for %: %', p_listing_id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_status_holds_units(
  p_status text,
  p_expires timestamptz,
  p_now timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('reserved', 'confirmed', 'active', 'awaiting_return')
    OR (p_status = 'proposed' AND p_expires IS NOT NULL AND p_expires > p_now);
$$;

CREATE OR REPLACE FUNCTION public.rental_dates_open(
  p_listing_id uuid,
  p_start timestamptz,
  p_end timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM generate_series(
      (p_start AT TIME ZONE 'UTC')::date,
      ((p_end - interval '1 second') AT TIME ZONE 'UTC')::date,
      interval '1 day'
    ) AS d(day)
    JOIN public.rental_listing_weekly_availability w
      ON w.listing_id = p_listing_id
     AND w.weekday = EXTRACT(DOW FROM d.day)::integer
     AND w.is_available IS FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.rental_availability_on_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.rental_status_holds_units(OLD.status::text, OLD.contract_expires_at, now())
     AND (
       NOT public.rental_status_holds_units(NEW.status::text, NEW.contract_expires_at, now())
       OR COALESCE(NEW.units_booked, 1) < COALESCE(OLD.units_booked, 1)
     )
  THEN
    PERFORM public.rental_claim_availability_for_listing(NEW.rental_location_listing_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_availability_on_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking uuid;
  v_listing uuid;
  v_status text;
  v_expires timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.start_at <= OLD.start_at
     AND NEW.end_at >= OLD.end_at
     AND NEW.rental_booking_id = OLD.rental_booking_id THEN
    RETURN NEW;
  END IF;
  v_booking := COALESCE(OLD.rental_booking_id, NEW.rental_booking_id);
  SELECT rental_location_listing_id, status::text, contract_expires_at
    INTO v_listing, v_status, v_expires
  FROM public.rental_bookings WHERE id = v_booking;
  IF v_listing IS NOT NULL
     AND public.rental_status_holds_units(v_status, v_expires, now()) THEN
    PERFORM public.rental_claim_availability_for_listing(v_listing);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_availability_on_listing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    NEW.is_active IS TRUE
    AND NEW.deleted_at IS NULL
    AND NEW.moderation_status = 'approved'
  ) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR OLD.is_active IS NOT TRUE
     OR OLD.deleted_at IS NOT NULL
     OR OLD.moderation_status IS DISTINCT FROM 'approved'
     OR NEW.units_available > OLD.units_available THEN
    PERFORM public.rental_claim_availability_for_listing(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_availability_on_booking ON public.rental_bookings;
CREATE TRIGGER rental_availability_on_booking
  AFTER UPDATE OF status, units_booked ON public.rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.rental_availability_on_booking();

DROP TRIGGER IF EXISTS rental_availability_on_window ON public.rental_booking_windows;
CREATE TRIGGER rental_availability_on_window
  AFTER INSERT OR UPDATE OR DELETE ON public.rental_booking_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.rental_availability_on_window();

DROP TRIGGER IF EXISTS rental_availability_on_listing ON public.rental_location_listings;
CREATE TRIGGER rental_availability_on_listing
  AFTER INSERT OR UPDATE OF is_active, moderation_status, deleted_at, units_available
  ON public.rental_location_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.rental_availability_on_listing();

-- Proposed holds expire by the clock, with no row change. This scan covers that
-- gap. Write triggers still claim immediately when a hold is released or a
-- listing is published. Payment-enabled is not in this SQL: booking still
-- rejects a location whose payments are off.
CREATE OR REPLACE FUNCTION public.rental_availability_scan()
RETURNS SETOF public.rental_availability_notices
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub record;
  v_listing uuid;
BEGIN
  FOR v_sub IN
    SELECT *
    FROM public.rental_availability_subscriptions
    WHERE status = 'active' AND expires_at > now()
    ORDER BY created_at
    LIMIT 40
  LOOP
    v_listing := NULL;
    SELECT l.id INTO v_listing
    FROM public.rental_location_listings l
    JOIN public.rental_items i ON i.id = l.rental_item_id
    JOIN public.rental_categories c ON c.id = i.rental_category_id
    JOIN public.businesses biz ON biz.id = i.business_id
    JOIN public.business_locations bl ON bl.id = l.business_location_id
    LEFT JOIN public.addresses a ON a.id = bl.address_id
    WHERE l.is_active IS TRUE
      AND l.deleted_at IS NULL
      AND l.moderation_status = 'approved'
      AND i.is_active IS TRUE
      AND i.deleted_at IS NULL
      AND biz.is_storefront_visible IS TRUE
      AND bl.is_active IS TRUE
      AND (
        v_sub.country_code IS NULL OR btrim(v_sub.country_code) = ''
        OR lower(btrim(v_sub.country_code)) = lower(btrim(COALESCE(a.country, '')))
      )
      AND (
        v_sub.state IS NULL OR btrim(v_sub.state) = ''
        OR lower(btrim(v_sub.state)) = lower(btrim(COALESCE(a.state, '')))
      )
      AND (v_sub.category_id IS NULL OR v_sub.category_id = i.rental_category_id)
      AND (
        v_sub.query_norm = ''
        OR i.name ILIKE '%' || v_sub.query_norm || '%'
        OR c.name ILIKE '%' || v_sub.query_norm || '%'
      )
      AND public.rental_dates_open(l.id, v_sub.start_at, v_sub.end_at)
      AND public.rental_peak_units_held(l.id, v_sub.start_at, v_sub.end_at, now()) + 1
          <= GREATEST(COALESCE(l.units_available, 1), 1)
    LIMIT 1;
    IF v_listing IS NOT NULL THEN
      PERFORM public.rental_claim_availability_for_listing(v_listing);
    END IF;
  END LOOP;
  RETURN;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'rental availability scan failed: %', SQLERRM;
  RETURN;
END;
$$;
