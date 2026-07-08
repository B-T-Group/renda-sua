-- Items: product tax classification
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS stripe_tax_code_id TEXT
        REFERENCES public.stripe_tax_codes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.items
    ALTER COLUMN stripe_tax_code_id SET DEFAULT 'txcd_99999999';

-- Idempotent backfill: only rows without a tax code
UPDATE public.items
SET stripe_tax_code_id = 'txcd_99999999',
    updated_at = NOW()
WHERE stripe_tax_code_id IS NULL;

-- Order line tax snapshots
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS stripe_tax_code_id TEXT,
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Order-level tax persistence
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tax_status TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS tax_jurisdiction JSONB,
    ADD COLUMN IF NOT EXISTS tax_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS stripe_tax_calculation_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_tax_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS pre_tax_total DECIMAL(10, 2);

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_tax_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_tax_status_check
        CHECK (tax_status IN ('none', 'estimated', 'finalized'));

-- Stripe payment ledger tax fields
ALTER TABLE public.stripe_payment_transactions
    ADD COLUMN IF NOT EXISTS amount_subtotal DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS amount_tax DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS stripe_tax_calculation_id TEXT;
