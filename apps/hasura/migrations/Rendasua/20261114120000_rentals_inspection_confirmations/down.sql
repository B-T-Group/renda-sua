-- Keep RENTAL_STARTED and RENTAL_CONDITION_REPORT_SENT. user_messages.message_type
-- references message_types, so deleting the types fails once a row exists.
DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_inspection_confirmations_enabled' AND country_code IS NULL;
