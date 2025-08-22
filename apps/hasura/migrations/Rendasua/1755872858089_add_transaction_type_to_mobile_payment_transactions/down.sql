-- Remove transaction_type column from mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions DROP COLUMN transaction_type;

-- Drop the enum type
DROP TYPE mobile_payment_transaction_type_enum;
