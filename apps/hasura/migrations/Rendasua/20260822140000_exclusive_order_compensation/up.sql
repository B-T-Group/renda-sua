-- One completed order can credit at most one representative commission.
-- Agent onboarding milestones must be tied to that order.

DROP INDEX IF EXISTS uq_rce_order_sale_percent;

-- Attach unused completed orders 1:1 so sibling rows cannot share an order.
WITH need_order AS (
  SELECT e.id AS event_id,
         e.business_id,
         ROW_NUMBER() OVER (
           PARTITION BY e.business_id
           ORDER BY e.created_at, e.id
         ) AS event_n
  FROM public.representative_compensation_events e
  WHERE e.rule_code IN (
      'onboarding_10_first_sale',
      'onboarding_25_small_sale',
      'onboarding_25_large_sale'
    )
    AND e.triggering_order_id IS NULL
    AND e.status <> 'credited'
    AND e.business_id IS NOT NULL
),
free_orders AS (
  SELECT o.business_id,
         o.id AS order_id,
         ROW_NUMBER() OVER (
           PARTITION BY o.business_id
           ORDER BY o.completed_at NULLS LAST, o.created_at, o.id
         ) AS order_n
  FROM public.orders o
  WHERE o.current_status IN ('complete', 'delivered')
    AND NOT EXISTS (
      SELECT 1
      FROM public.representative_compensation_events x
      WHERE x.triggering_order_id = o.id
    )
),
matched AS (
  SELECT n.event_id, f.order_id
  FROM need_order n
  JOIN free_orders f
    ON f.business_id = n.business_id
   AND f.order_n = n.event_n
)
UPDATE public.representative_compensation_events e
SET triggering_order_id = matched.order_id
FROM matched
WHERE e.id = matched.event_id;

-- Losing sale_percent rows cannot keep a null order under the original CHECK.
ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_sale_percent_order_check;

-- One order may already have both an onboarding row and sale_percent; keep one.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY triggering_order_id
           ORDER BY
             CASE
               WHEN rule_code IN (
                 'onboarding_10_first_sale',
                 'onboarding_25_small_sale',
                 'onboarding_25_large_sale'
               ) THEN 0
               ELSE 1
             END,
             CASE status
               WHEN 'credited' THEN 0
               WHEN 'pending' THEN 1
               ELSE 2
             END,
             created_at,
             id
         ) AS rn
  FROM public.representative_compensation_events
  WHERE triggering_order_id IS NOT NULL
)
UPDATE public.representative_compensation_events e
SET triggering_order_id = NULL
FROM ranked
WHERE e.id = ranked.id
  AND ranked.rn > 1;

-- Pending onboarding/sale_percent without an order cannot satisfy the new CHECKs.
UPDATE public.representative_compensation_events
SET status = 'failed'
WHERE rule_code IN (
    'onboarding_10_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'sale_percent'
  )
  AND triggering_order_id IS NULL
  AND status = 'pending';

CREATE UNIQUE INDEX uq_rce_order_id
  ON public.representative_compensation_events (triggering_order_id)
  WHERE triggering_order_id IS NOT NULL;

ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_onboarding_order_check;

-- New pending onboarding needs an order; credited/failed catalog-only rows may stay.
ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_onboarding_order_check
  CHECK (
    rule_code NOT IN (
      'onboarding_10_first_sale',
      'onboarding_25_small_sale',
      'onboarding_25_large_sale'
    )
    OR triggering_order_id IS NOT NULL
    OR status <> 'pending'
  );

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_sale_percent_order_check
  CHECK (
    rule_code <> 'sale_percent'
    OR triggering_order_id IS NOT NULL
    OR status <> 'pending'
  );

COMMENT ON TABLE public.representative_compensation_events IS
  'Immutable representative compensation ledger. One row per credit; each completed order pays at most one commission.';
COMMENT ON COLUMN public.representative_compensation_events.amount IS
  'Wallet credit for this event (full milestone amount, or 1% of order subtotal).';
COMMENT ON COLUMN public.representative_compensation_events.gross_milestone_amount IS
  'Configured onboarding amount for this rule (null for sale_percent / B2B).';
