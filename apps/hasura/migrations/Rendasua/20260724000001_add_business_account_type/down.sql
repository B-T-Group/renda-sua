DROP TABLE IF EXISTS public.business_account_type_history;

ALTER TABLE public.businesses
    DROP COLUMN IF EXISTS account_type_locked_until;

ALTER TABLE public.businesses
    DROP COLUMN IF EXISTS account_type;

DROP TABLE IF EXISTS public.business_account_types;
