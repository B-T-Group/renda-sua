ALTER TABLE public.stripe_payment_transactions
    DROP COLUMN IF EXISTS stripe_tax_calculation_id,
    DROP COLUMN IF EXISTS amount_tax,
    DROP COLUMN IF EXISTS amount_subtotal;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_tax_status_check,
    DROP COLUMN IF EXISTS pre_tax_total,
    DROP COLUMN IF EXISTS stripe_tax_transaction_id,
    DROP COLUMN IF EXISTS stripe_tax_calculation_id,
    DROP COLUMN IF EXISTS tax_breakdown,
    DROP COLUMN IF EXISTS tax_jurisdiction,
    DROP COLUMN IF EXISTS tax_status;

ALTER TABLE public.order_items
    DROP COLUMN IF EXISTS tax_amount,
    DROP COLUMN IF EXISTS stripe_tax_code_id;

ALTER TABLE public.items
    DROP COLUMN IF EXISTS stripe_tax_code_id;
