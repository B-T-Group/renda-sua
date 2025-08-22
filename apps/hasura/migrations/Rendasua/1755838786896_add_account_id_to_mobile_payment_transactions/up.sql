-- Add account_id column to mobile_payment_transactions table
ALTER TABLE public.mobile_payment_transactions 
ADD COLUMN account_id UUID;

-- Add foreign key constraint
ALTER TABLE public.mobile_payment_transactions 
ADD CONSTRAINT fk_mobile_payment_transactions_account 
FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE RESTRICT ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_mobile_payment_transactions_account_id ON public.mobile_payment_transactions(account_id);

-- Add comment
COMMENT ON COLUMN public.mobile_payment_transactions.account_id IS 'Reference to the user account associated with this transaction';
