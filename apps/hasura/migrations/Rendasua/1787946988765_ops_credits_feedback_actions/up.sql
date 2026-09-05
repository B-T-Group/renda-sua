-- Ops credits call-back: in-person channel + test/internal order classification.

ALTER TYPE public.credit_contact_channel ADD VALUE IF NOT EXISTS 'in_person';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'order_ops_classification'
  ) THEN
    CREATE TYPE public.order_ops_classification AS ENUM ('test', 'internal');
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ops_classification public.order_ops_classification;

COMMENT ON COLUMN public.orders.ops_classification IS
  'Ops mark: test or internal orders leave credit call-back queues and never earn cancelled/first-order credit';
