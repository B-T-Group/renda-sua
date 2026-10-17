-- Migration: add_fedapay_payment_system_tg
-- Description: Add FedaPay as a supported payment system for Togo (TG), initially inactive.
--              FedaPay will be activated after configuration and testing are complete.

-- Add fedapay to supported_payment_systems for TG (Togo), initially inactive
INSERT INTO public.supported_payment_systems (name, country, active) VALUES
    ('fedapay', 'TG', false)
ON CONFLICT (name, country) DO UPDATE
SET active = EXCLUDED.active,
    updated_at = NOW();
