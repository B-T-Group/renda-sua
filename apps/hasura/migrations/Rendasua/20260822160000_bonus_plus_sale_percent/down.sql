DROP INDEX IF EXISTS uq_rce_order_sale_percent;

CREATE UNIQUE INDEX uq_rce_order_id
  ON public.representative_compensation_events (triggering_order_id)
  WHERE triggering_order_id IS NOT NULL;
