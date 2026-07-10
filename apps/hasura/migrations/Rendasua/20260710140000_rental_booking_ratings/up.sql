-- Add rental rating enum values.
-- Must be a separate migration from any CHECK that references these values:
-- Postgres requires new enum values to be committed before use (55P04).

ALTER TYPE public.rating_type_enum ADD VALUE IF NOT EXISTS 'client_to_rental_item';
ALTER TYPE public.rating_type_enum ADD VALUE IF NOT EXISTS 'client_to_rental_business';
