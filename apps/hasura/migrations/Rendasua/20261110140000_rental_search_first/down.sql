DROP TRIGGER IF EXISTS rental_availability_on_listing ON public.rental_location_listings;
DROP TRIGGER IF EXISTS rental_availability_on_window ON public.rental_booking_windows;
DROP TRIGGER IF EXISTS rental_availability_on_booking ON public.rental_bookings;

DROP FUNCTION IF EXISTS public.rental_availability_scan();
DROP FUNCTION IF EXISTS public.rental_availability_on_listing();
DROP FUNCTION IF EXISTS public.rental_availability_on_window();
DROP FUNCTION IF EXISTS public.rental_availability_on_booking();
DROP FUNCTION IF EXISTS public.rental_claim_availability_for_listing(uuid);
DROP FUNCTION IF EXISTS public.rental_dates_open(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.rental_status_holds_units(text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.rental_peak_units_held(uuid, timestamptz, timestamptz, timestamptz);

DROP TABLE IF EXISTS public.rental_availability_notices;
DROP TABLE IF EXISTS public.rental_availability_subscriptions;

DROP INDEX IF EXISTS public.rental_categories_name_trgm;
DROP INDEX IF EXISTS public.rental_items_description_trgm;
DROP INDEX IF EXISTS public.rental_items_name_trgm;

DELETE FROM public.message_types WHERE id = 'RENTAL_AVAILABLE';
DELETE FROM public.entity_types WHERE id = 'rental_availability_alert';

DELETE FROM public.application_configurations
WHERE config_key = 'rentals_search_first_enabled' AND country_code IS NULL;
