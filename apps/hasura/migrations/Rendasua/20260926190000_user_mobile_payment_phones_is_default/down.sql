DROP INDEX IF EXISTS public.uq_user_mobile_payment_phones_user_default;

ALTER TABLE public.user_mobile_payment_phones
  DROP COLUMN IF EXISTS is_default;
