-- Migration: drop_delivery_fees_table
-- Description: Drop the old delivery_fees table as it's being replaced by country_delivery_configs

-- Drop the delivery_fees table
DROP TABLE IF EXISTS public.delivery_fees CASCADE;

