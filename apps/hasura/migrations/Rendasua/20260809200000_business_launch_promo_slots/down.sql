DROP FUNCTION IF EXISTS public.restore_business_launch_promo_order(uuid, uuid);
DROP FUNCTION IF EXISTS public.consume_business_launch_promo_order(uuid, uuid);
DROP FUNCTION IF EXISTS public.consume_business_launch_promo_order(uuid);
DROP FUNCTION IF EXISTS public.claim_business_launch_promo_slot(uuid, text);
DROP TABLE IF EXISTS public.business_launch_promo_consumptions;
DROP TABLE IF EXISTS public.business_launch_promo_slots;

DELETE FROM public.application_configurations
WHERE config_key IN (
  'launch_promo_business_limit',
  'launch_promo_zero_commission_orders',
  'launch_promo_identification_window_days'
);
