-- Stamp the cutoff as a real timestamptz, and give overdue requests a window
-- measured from the later of that cutoff and the moment this runs.

CREATE OR REPLACE FUNCTION public.normalized_country_key(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(btrim(COALESCE(p_country, '')));
$$;

CREATE OR REPLACE FUNCTION public.address_country_key(address_row public.addresses)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.normalized_country_key(address_row.country);
$$;

CREATE OR REPLACE FUNCTION public.extend_overdue_rental_respond_by(
  p_cutoff timestamptz,
  p_country text
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
  v_base timestamptz := GREATEST(p_cutoff, now());
BEGIN
  UPDATE public.rental_requests AS request
     SET respond_by = GREATEST(
       LEAST(
         GREATEST(COALESCE(request.respond_by, v_base), v_base + interval '24 hours'),
         COALESCE(request.requested_start_at, v_base + interval '24 hours')
       ),
       p_cutoff
     )
   WHERE request.status::text = 'pending'
     AND (request.respond_by IS NULL OR request.respond_by < v_base)
     AND (
       p_country IS NULL
       OR EXISTS (
         SELECT 1
           FROM public.rental_location_listings AS listing
           JOIN public.business_locations AS location
             ON location.id = listing.business_location_id
           JOIN public.addresses AS address
             ON address.id = location.address_id
          WHERE listing.id = request.rental_location_listing_id
            AND public.normalized_country_key(address.country) = ANY (
              SELECT public.normalized_country_key(spelling)
                FROM unnest(public.rental_address_spellings(p_country)) AS spelling
            )
       )
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_rental_autodecline_since()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff timestamptz := now();
BEGIN
  IF NEW.config_key = 'rentals_dashboard_requests_enabled'
     AND COALESCE(NEW.boolean_value, false)
     AND COALESCE(NEW.status, '') = 'active'
     AND (
       TG_OP = 'INSERT'
       OR COALESCE(OLD.boolean_value, false) IS DISTINCT FROM TRUE
       OR COALESCE(OLD.status, '') IS DISTINCT FROM 'active'
     ) THEN
    INSERT INTO public.application_configurations (
      config_key, config_name, description, data_type, string_value,
      country_code, status, version, tags
    )
    SELECT
      'rentals_dashboard_requests_autodecline_since',
      'Rental auto-decline cutoff',
      'Pending requests already due get a new respond_by of this instant plus 24 hours, capped at the start.',
      'string',
      to_char(v_cutoff AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      NEW.country_code,
      'active', 1,
      ARRAY['rentals']
    WHERE NOT EXISTS (
      SELECT 1 FROM public.application_configurations
       WHERE config_key = 'rentals_dashboard_requests_autodecline_since'
         AND country_code IS NOT DISTINCT FROM NEW.country_code
    );
    PERFORM public.extend_overdue_rental_respond_by(v_cutoff, NEW.country_code);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT country_code, string_value::timestamptz AS cutoff
      FROM public.application_configurations
     WHERE config_key = 'rentals_dashboard_requests_autodecline_since'
       AND COALESCE(status, '') = 'active'
       AND string_value IS NOT NULL
  LOOP
    PERFORM public.extend_overdue_rental_respond_by(rec.cutoff, rec.country_code);
  END LOOP;
END $$;
