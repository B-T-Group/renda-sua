-- Change entity_id column type from uuid to text in mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
ALTER COLUMN entity_id TYPE text;
