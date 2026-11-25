CREATE OR REPLACE FUNCTION public.extend_overdue_rental_respond_by(
  p_cutoff timestamptz,
  p_country text
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.rental_requests AS request
     SET respond_by = GREATEST(
       LEAST(
         GREATEST(COALESCE(request.respond_by, p_cutoff), p_cutoff + interval '24 hours'),
         COALESCE(request.requested_start_at, p_cutoff + interval '24 hours')
       ),
       p_cutoff
     )
   WHERE request.status::text = 'pending'
     AND (request.respond_by IS NULL OR request.respond_by < p_cutoff)
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
            AND upper(btrim(address.country)) = ANY (
              SELECT upper(spelling)
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
  v_cutoff timestamptz := timezone('UTC', now());
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
      to_char(v_cutoff, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      NEW.country_code,
      'active', 1,
      ARRAY['rentals']
    WHERE NOT EXISTS (
      SELECT 1 FROM public.application_configurations
       WHERE config_key = 'rentals_dashboard_requests_autodecline_since'
         AND country_code IS NOT DISTINCT FROM NEW.country_code
    );
    IF FOUND THEN
      PERFORM public.extend_overdue_rental_respond_by(v_cutoff, NEW.country_code);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.address_country_key(public.addresses);
DROP FUNCTION IF EXISTS public.normalized_country_key(text);
