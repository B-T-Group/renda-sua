-- Add back the dropped columns
ALTER TABLE mobile_payment_transactions 
ADD COLUMN callback_url text,
ADD COLUMN return_url text;

-- Drop the payment_entity column
ALTER TABLE mobile_payment_transactions 
DROP COLUMN IF EXISTS payment_entity;

-- Drop the enum type
DROP TYPE IF EXISTS payment_entity_type;
