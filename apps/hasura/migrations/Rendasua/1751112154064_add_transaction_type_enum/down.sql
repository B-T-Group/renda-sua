-- Revert account_transactions table to use TEXT
ALTER TABLE public.account_transactions 
ALTER COLUMN transaction_type TYPE TEXT;

-- Drop enum
DROP TYPE IF EXISTS public.transaction_type_enum;
