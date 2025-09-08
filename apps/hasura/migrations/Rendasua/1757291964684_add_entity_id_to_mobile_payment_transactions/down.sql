-- Remove entity_id column from mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
DROP COLUMN entity_id;
