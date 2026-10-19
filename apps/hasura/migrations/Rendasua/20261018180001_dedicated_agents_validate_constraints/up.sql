-- #594 PR 1, step 2 (its own transaction): validate the NOT VALID constraints added by
-- 20261018180000 and build the two partial indexes on the hot tables.
-- VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE (reads and writes continue) while it scans.
-- CREATE INDEX takes SHARE (reads continue, writes wait for the build; both indexes are partial
-- and start empty). apply-hasura runs `migrate apply --per-migration-transaction`, so this
-- file commits separately from 180000 and its ACCESS EXCLUSIVE locks are released first.
-- lock_timeout: fail fast rather than queue; re-run on timeout.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.orders VALIDATE CONSTRAINT orders_coverage_slot_key_check;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_assignment_source_check;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_dedicated_assignment_id_fkey;
ALTER TABLE public.order_offers VALIDATE CONSTRAINT order_offers_offer_kind_check;
ALTER TABLE public.order_offers VALIDATE CONSTRAINT order_offers_decline_reason_check;

CREATE INDEX IF NOT EXISTS orders_dedicated_assignment_idx
  ON public.orders (dedicated_assignment_id) WHERE dedicated_assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_offers_dedicated_outstanding_idx
  ON public.order_offers (agent_id, expires_at) WHERE offer_kind = 'dedicated' AND status = 'offered';
