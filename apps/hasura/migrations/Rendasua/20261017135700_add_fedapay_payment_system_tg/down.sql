-- Rollback: add_fedapay_payment_system_tg
-- Remove FedaPay payment system for Togo

DELETE FROM public.supported_payment_systems
WHERE name = 'fedapay' AND country = 'TG';
