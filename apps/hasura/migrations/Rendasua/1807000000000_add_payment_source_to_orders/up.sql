-- Create enum for order payment source
CREATE TYPE public.payment_source_enum AS ENUM (
  'credit_card',
  'mobile_payment',
  'wallet'
);

-- Add payment_source column to orders (nullable for existing rows; new orders set it on create)
ALTER TABLE public.orders
  ADD COLUMN payment_source public.payment_source_enum;

COMMENT ON COLUMN public.orders.payment_source IS 'How the order was paid: credit_card, mobile_payment, or wallet';
