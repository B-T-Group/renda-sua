-- Migration: create_commission_payouts_table
-- Description: Create commission_payouts table to audit commission distributions

CREATE TABLE public.commission_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('partner', 'rendasua', 'agent', 'business')),
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN (
        'base_delivery_fee', 
        'per_km_delivery_fee', 
        'item_sale', 
        'order_subtotal'
    )),
    amount DECIMAL(18,2) NOT NULL,
    currency currency_enum NOT NULL,
    commission_percentage DECIMAL(5,2),
    account_transaction_id UUID REFERENCES public.account_transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_commission_payouts_order_id ON public.commission_payouts(order_id);
CREATE INDEX idx_commission_payouts_recipient_user_id ON public.commission_payouts(recipient_user_id);
CREATE INDEX idx_commission_payouts_recipient_type ON public.commission_payouts(recipient_type);
CREATE INDEX idx_commission_payouts_created_at ON public.commission_payouts(created_at);

-- Add comments
COMMENT ON TABLE public.commission_payouts IS 'Audit trail for commission distributions';
COMMENT ON COLUMN public.commission_payouts.recipient_type IS 'Type of recipient (partner, rendasua, agent, business)';
COMMENT ON COLUMN public.commission_payouts.commission_type IS 'Type of commission (base_delivery_fee, per_km_delivery_fee, item_sale, order_subtotal)';
COMMENT ON COLUMN public.commission_payouts.amount IS 'Commission amount paid out';
COMMENT ON COLUMN public.commission_payouts.commission_percentage IS 'Commission percentage applied';
COMMENT ON COLUMN public.commission_payouts.account_transaction_id IS 'Reference to the account transaction created';
