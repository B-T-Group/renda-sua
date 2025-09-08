-- Add entity_id column to mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
ADD COLUMN entity_id uuid;
