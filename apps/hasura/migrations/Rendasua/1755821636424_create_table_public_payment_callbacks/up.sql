-- Create payment_callbacks table
CREATE TABLE public.payment_callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.mobile_payment_transactions(id) ON DELETE CASCADE,
    callback_data JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_payment_callbacks_transaction_id ON public.payment_callbacks(transaction_id);
CREATE INDEX idx_payment_callbacks_received_at ON public.payment_callbacks(received_at);
CREATE INDEX idx_payment_callbacks_processed ON public.payment_callbacks(processed);
