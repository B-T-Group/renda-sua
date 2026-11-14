DELETE FROM public.user_messages WHERE message_type = 'RENTAL_NOT_RECEIVED';

DELETE FROM public.message_types WHERE id = 'RENTAL_NOT_RECEIVED';

DROP TABLE IF EXISTS public.rental_not_received_reports;

DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_not_received_report_enabled' AND country_code IS NULL;
