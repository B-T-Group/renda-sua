-- Add back the payment_url column
ALTER TABLE mobile_payment_transactions 
ADD COLUMN payment_url text;
