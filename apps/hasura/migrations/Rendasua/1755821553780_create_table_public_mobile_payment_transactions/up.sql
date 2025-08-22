-- Create mobile_payment_transactions table
CREATE TABLE public.mobile_payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    transaction_id VARCHAR(255),
    payment_url TEXT,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    callback_url TEXT,
    return_url TEXT,
    error_message TEXT,
    error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_mobile_payment_transactions_reference ON public.mobile_payment_transactions(reference);
CREATE INDEX idx_mobile_payment_transactions_provider ON public.mobile_payment_transactions(provider);
CREATE INDEX idx_mobile_payment_transactions_status ON public.mobile_payment_transactions(status);
CREATE INDEX idx_mobile_payment_transactions_created_at ON public.mobile_payment_transactions(created_at);
CREATE INDEX idx_mobile_payment_transactions_transaction_id ON public.mobile_payment_transactions(transaction_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mobile_payment_transactions_updated_at 
    BEFORE UPDATE ON public.mobile_payment_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
