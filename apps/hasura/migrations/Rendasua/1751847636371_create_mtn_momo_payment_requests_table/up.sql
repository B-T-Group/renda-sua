-- Create mtn_momo_payment_requests table
CREATE TABLE public.mtn_momo_payment_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payer_message TEXT,
    payee_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_mtn_momo_payment_requests_user_id ON public.mtn_momo_payment_requests(user_id);
CREATE INDEX idx_mtn_momo_payment_requests_transaction_id ON public.mtn_momo_payment_requests(transaction_id);
CREATE INDEX idx_mtn_momo_payment_requests_external_id ON public.mtn_momo_payment_requests(external_id);
CREATE INDEX idx_mtn_momo_payment_requests_status ON public.mtn_momo_payment_requests(status);
CREATE INDEX idx_mtn_momo_payment_requests_created_at ON public.mtn_momo_payment_requests(created_at);

-- Create unique constraint on transaction_id to prevent duplicates
CREATE UNIQUE INDEX idx_mtn_momo_payment_requests_transaction_id_unique ON public.mtn_momo_payment_requests(transaction_id);

-- Add comment to table
COMMENT ON TABLE public.mtn_momo_payment_requests IS 'Tracks MTN MoMo payment requests made by users'; 