-- Keep RENTAL_REQUEST_NO_RESPONSE and RENTAL_REQUEST_EXPIRED. user_messages.message_type
-- references message_types, so deleting the types fails once a row exists.
DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_dashboard_requests_enabled' AND country_code IS NULL;
