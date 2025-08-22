-- Create enum for transaction types
CREATE TYPE mobile_payment_transaction_type_enum AS ENUM ('PAYMENT', 'GIVE_CHANGE');

-- Add transaction_type column to mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
ADD COLUMN transaction_type mobile_payment_transaction_type_enum NOT NULL DEFAULT 'PAYMENT';
