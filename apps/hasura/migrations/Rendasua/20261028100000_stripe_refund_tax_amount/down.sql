-- Down: drop the tax part. Refund amounts (the ledger part) are untouched; the tax part of
-- past tax-inclusive refunds stays visible on the Stripe refund objects and in
-- order_tax_reversals (if that migration is still applied).
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.stripe_refunds
  DROP COLUMN IF EXISTS tax_refund_amount;
