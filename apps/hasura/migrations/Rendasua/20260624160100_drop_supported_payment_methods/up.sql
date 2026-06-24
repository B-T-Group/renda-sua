-- Migration: drop_supported_payment_methods
-- Description: Drop supported_payment_methods from supported_country_states. Payment methods per
--              country are now sourced from the supported_payment_systems table.

ALTER TABLE public.supported_country_states DROP COLUMN IF EXISTS supported_payment_methods;
