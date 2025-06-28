-- Create account_transactions table
CREATE TABLE public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    transaction_type TEXT NOT NULL, -- e.g., 'deposit', 'withdrawal', 'hold', 'release', 'transfer', 'payment', 'refund'
    memo TEXT, -- Optional memo/notes for the transaction
    reference_id UUID, -- for linking to orders, payments, etc. (optional)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_account_transactions_account FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE RESTRICT ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_account_transactions_account_id ON public.account_transactions(account_id);
CREATE INDEX idx_account_transactions_type ON public.account_transactions(transaction_type);
CREATE INDEX idx_account_transactions_reference ON public.account_transactions(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX idx_account_transactions_created_at ON public.account_transactions(created_at);

-- Add comments
COMMENT ON TABLE public.account_transactions IS 'Tracks all account transactions with memo and reference linking';
COMMENT ON COLUMN public.account_transactions.amount IS 'Transaction amount (positive for credits, negative for debits)';
COMMENT ON COLUMN public.account_transactions.transaction_type IS 'Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund)';
COMMENT ON COLUMN public.account_transactions.memo IS 'Optional memo/notes for the transaction';
COMMENT ON COLUMN public.account_transactions.reference_id IS 'Optional reference to other business objects (orders, payments, etc.)';
