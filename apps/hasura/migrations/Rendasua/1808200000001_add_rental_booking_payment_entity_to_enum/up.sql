-- Add rental_booking to payment_entity_type enum
ALTER TYPE public.payment_entity_type ADD VALUE IF NOT EXISTS 'rental_booking';

