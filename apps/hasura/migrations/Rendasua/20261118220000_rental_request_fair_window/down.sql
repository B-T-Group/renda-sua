CREATE OR REPLACE FUNCTION public.stamp_rental_autodecline_since()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      'Pending requests with respond_by before this instant are left alone.',
      'string',
      to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      NEW.country_code,
      'active', 1,
      ARRAY['rentals']
    WHERE NOT EXISTS (
      SELECT 1 FROM public.application_configurations
       WHERE config_key = 'rentals_dashboard_requests_autodecline_since'
         AND country_code IS NOT DISTINCT FROM NEW.country_code
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.extend_overdue_rental_respond_by(timestamptz, text);
DROP FUNCTION IF EXISTS public.rental_address_spellings(text);
