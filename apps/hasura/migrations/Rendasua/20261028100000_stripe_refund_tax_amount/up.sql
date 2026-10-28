-- Tax-inclusive refunds (PR #691 follow-up).
--
-- stripe_refunds.amount stays what it always was: the part of the refund measured in the
-- order's own (pre-tax) ledger terms. The wallet reversal, the merchant clawback and the
-- post-delivery refund-payment rows all read it, so they are unchanged.
-- tax_refund_amount is the tax returned to the card ON TOP of it, for orders whose Stripe
-- Tax snapshot is finalized. The Stripe refund (and the Stripe Tax reversal) is
-- amount + tax_refund_amount. Existing rows and legacy refunds keep 0.
--
-- Additive and metadata-free: a constant default needs no table rewrite on Postgres 11+.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.stripe_refunds
  ADD COLUMN IF NOT EXISTS tax_refund_amount numeric(12, 2) NOT NULL DEFAULT 0
  CHECK (tax_refund_amount >= 0);

COMMENT ON COLUMN public.stripe_refunds.tax_refund_amount IS
  'Tax returned to the card in addition to amount (tax-inclusive refunds). Card refund = amount + tax_refund_amount. 0 for legacy/pre-tax refunds.';
