-- Drop index
DROP INDEX IF EXISTS idx_mobile_payment_transactions_account_id;

-- Drop foreign key constraint
ALTER TABLE public.mobile_payment_transactions 
DROP CONSTRAINT IF EXISTS fk_mobile_payment_transactions_account;

-- Drop account_id column
ALTER TABLE public.mobile_payment_transactions 
DROP COLUMN IF EXISTS account_id;
