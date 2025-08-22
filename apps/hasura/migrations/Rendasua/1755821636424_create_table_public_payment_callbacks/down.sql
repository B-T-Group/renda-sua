-- Drop indexes
DROP INDEX IF EXISTS idx_payment_callbacks_transaction_id;
DROP INDEX IF EXISTS idx_payment_callbacks_received_at;
DROP INDEX IF EXISTS idx_payment_callbacks_processed;

-- Drop table
DROP TABLE IF EXISTS public.payment_callbacks;
