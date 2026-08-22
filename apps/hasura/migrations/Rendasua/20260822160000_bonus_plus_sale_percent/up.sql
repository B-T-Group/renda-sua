-- Allow a 7,500 onboarding bonus and 1% sale commission on the same order.

DROP INDEX IF EXISTS uq_rce_order_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rce_order_sale_percent
  ON public.representative_compensation_events (triggering_order_id, rule_code)
  WHERE rule_code = 'sale_percent'
  AND triggering_order_id IS NOT NULL;
