-- #594 PR 1: validate the NOT VALID constraints added by 20261018180000 in a separate transaction.
-- VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE (reads and writes continue) while it scans.
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_coverage_slot_key_check;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_assignment_source_check;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_dedicated_assignment_id_fkey;
ALTER TABLE public.order_offers VALIDATE CONSTRAINT order_offers_offer_kind_check;
ALTER TABLE public.order_offers VALIDATE CONSTRAINT order_offers_decline_reason_check;
