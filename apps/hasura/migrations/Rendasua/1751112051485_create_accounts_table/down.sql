-- Drop trigger first
DROP TRIGGER IF EXISTS set_public_accounts_updated_at ON public.accounts;

-- Drop table
DROP TABLE IF EXISTS public.accounts;

-- Drop enums
DROP TYPE IF EXISTS public.currency_enum;
DROP TYPE IF EXISTS public.account_type_enum;
