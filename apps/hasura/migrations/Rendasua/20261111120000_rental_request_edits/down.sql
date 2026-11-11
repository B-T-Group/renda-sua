DROP FUNCTION IF EXISTS public.apply_rental_request_edit(
  uuid, uuid, uuid, integer, jsonb, integer, text, jsonb, timestamptz
);
DROP FUNCTION IF EXISTS public.rental_peak_units_held_except(
  uuid, timestamptz, timestamptz, timestamptz, uuid
);

DROP TABLE IF EXISTS public.rental_request_revisions;

ALTER TABLE public.rental_requests
  DROP CONSTRAINT IF EXISTS rental_requests_edit_version_check;

ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS change_summary,
  DROP COLUMN IF EXISTS quoted_total,
  DROP COLUMN IF EXISTS edit_version;

DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_modify_request_enabled' AND country_code IS NULL;

DELETE FROM public.message_types WHERE id = 'RENTAL_REQUEST_UPDATED';
