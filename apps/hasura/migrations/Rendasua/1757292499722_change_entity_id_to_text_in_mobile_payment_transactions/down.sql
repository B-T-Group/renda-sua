-- Change entity_id column type back from text to uuid in mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;
