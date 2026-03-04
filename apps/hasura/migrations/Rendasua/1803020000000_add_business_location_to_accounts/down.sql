DROP INDEX IF EXISTS public.idx_accounts_business_location;
DROP INDEX IF EXISTS public.idx_accounts_user_currency_location;
DROP INDEX IF EXISTS public.idx_accounts_user_currency_legacy;

ALTER TABLE public.accounts DROP COLUMN IF EXISTS business_location_id;

CREATE UNIQUE INDEX idx_accounts_user_currency ON public.accounts(user_id, currency);
