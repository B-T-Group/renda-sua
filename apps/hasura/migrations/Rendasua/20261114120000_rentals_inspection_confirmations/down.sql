DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_inspection_confirmations_enabled' AND country_code IS NULL;

DELETE FROM public.message_types WHERE id IN (
  'RENTAL_CONDITION_REPORT_SENT',
  'RENTAL_STARTED'
);
