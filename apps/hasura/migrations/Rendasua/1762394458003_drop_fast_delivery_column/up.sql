-- Migration: drop_fast_delivery_column
-- Description: Remove fast_delivery column from supported_country_states table

-- Drop the fast_delivery column from supported_country_states
ALTER TABLE public.supported_country_states
DROP COLUMN IF EXISTS fast_delivery;

