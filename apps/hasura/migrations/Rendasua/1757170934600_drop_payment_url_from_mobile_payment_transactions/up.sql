-- Drop payment_url column from mobile_payment_transactions
ALTER TABLE mobile_payment_transactions 
DROP COLUMN IF EXISTS payment_url;
