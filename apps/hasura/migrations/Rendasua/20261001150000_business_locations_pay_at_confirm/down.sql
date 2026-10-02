DELETE FROM public.application_configurations
WHERE config_key = 'pay_after_confirm_location_flag_enabled';

ALTER TABLE public.business_locations
  DROP COLUMN IF EXISTS pay_at_confirm;
