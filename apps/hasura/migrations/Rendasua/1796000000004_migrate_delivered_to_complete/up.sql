-- One-time data migration: set orders in 'delivered' status to 'complete'
-- (PIN-based flow uses out_for_delivery -> complete only; no more delivered)
UPDATE public.orders
SET current_status = 'complete'
WHERE current_status = 'delivered';
