ALTER TABLE public.agents DROP COLUMN IF EXISTS mobile_payment_phone_id;
ALTER TABLE public.business_locations DROP COLUMN IF EXISTS mobile_payment_phone_id;
DROP TABLE IF EXISTS public.user_mobile_payment_phones;
