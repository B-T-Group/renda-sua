-- Create airtel_money_payments table
CREATE TABLE public.airtel_money_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id text NOT NULL UNIQUE,
    reference text NOT NULL,
    amount text NOT NULL,
    currency text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    message text,
    notes text,
    callback_data jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_airtel_money_payments_user_id ON public.airtel_money_payments(user_id);
CREATE INDEX idx_airtel_money_payments_transaction_id ON public.airtel_money_payments(transaction_id);
CREATE INDEX idx_airtel_money_payments_reference ON public.airtel_money_payments(reference);
CREATE INDEX idx_airtel_money_payments_status ON public.airtel_money_payments(status);
CREATE INDEX idx_airtel_money_payments_created_at ON public.airtel_money_payments(created_at);

-- Create or replace the updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER set_airtel_money_payments_updated_at
    BEFORE UPDATE ON public.airtel_money_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_airtel_money_payments_updated_at ON public.airtel_money_payments
    IS 'trigger to set value of column "updated_at" to current timestamp on row update'; 