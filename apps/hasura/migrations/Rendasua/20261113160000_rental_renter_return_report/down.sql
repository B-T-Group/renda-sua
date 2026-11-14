DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_renter_return_report_enabled' AND country_code IS NULL;

DELETE FROM public.message_types WHERE id = 'RENTAL_RENTER_RETURN_REPORTED';

DROP INDEX IF EXISTS public.rental_bookings_return_report_escalation_idx;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS renter_return_escalated_at,
  DROP COLUMN IF EXISTS renter_reported_returned_at;
