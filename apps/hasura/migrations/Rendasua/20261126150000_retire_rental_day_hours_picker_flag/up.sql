-- Retire rentals_day_hours_picker_enabled (Samuel, 26 Nov 2026).
-- The day-and-hours picker, the listing switches and their server rules are now the only
-- rental request flow on mobile, web and Nest. No code reads this key any more.
-- Same pattern as 1762394458004_remove_delivery_configs_from_app_configs. Idempotent.
DELETE FROM public.application_configurations
WHERE config_key = 'rentals_day_hours_picker_enabled';
