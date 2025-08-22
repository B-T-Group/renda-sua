-- Drop trigger first
DROP TRIGGER IF EXISTS update_mobile_payment_transactions_updated_at ON public.mobile_payment_transactions;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_mobile_payment_transactions_reference;
DROP INDEX IF EXISTS idx_mobile_payment_transactions_provider;
DROP INDEX IF EXISTS idx_mobile_payment_transactions_status;
DROP INDEX IF EXISTS idx_mobile_payment_transactions_created_at;
DROP INDEX IF EXISTS idx_mobile_payment_transactions_transaction_id;

-- Drop table
DROP TABLE IF EXISTS public.mobile_payment_transactions;
