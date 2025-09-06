-- Create enum for payment entity types
CREATE TYPE payment_entity_type AS ENUM ('order', 'account');

-- Add new payment_entity column
ALTER TABLE mobile_payment_transactions 
ADD COLUMN payment_entity payment_entity_type;

-- Drop unused columns
ALTER TABLE mobile_payment_transactions 
DROP COLUMN IF EXISTS callback_url,
DROP COLUMN IF EXISTS return_url;
