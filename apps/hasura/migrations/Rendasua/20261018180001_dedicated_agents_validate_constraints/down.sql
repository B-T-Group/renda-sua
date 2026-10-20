-- Validation needs no undo (20261018180000/down.sql drops the constraints); drop the indexes built here.
DROP INDEX IF EXISTS public.order_offers_dedicated_outstanding_idx;
DROP INDEX IF EXISTS public.orders_dedicated_assignment_idx;
