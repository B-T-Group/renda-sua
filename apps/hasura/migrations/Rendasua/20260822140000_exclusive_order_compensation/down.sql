ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_onboarding_order_check;

ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_sale_percent_order_check;

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_sale_percent_order_check
  CHECK (
    rule_code <> 'sale_percent' OR triggering_order_id IS NOT NULL
  );

DROP INDEX IF EXISTS uq_rce_order_id;

CREATE UNIQUE INDEX uq_rce_order_sale_percent
  ON public.representative_compensation_events (triggering_order_id, rule_code)
  WHERE rule_code = 'sale_percent'
  AND triggering_order_id IS NOT NULL;
