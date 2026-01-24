-- Create order_label_prints table for shipping label print audit logging
CREATE TABLE public.order_label_prints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_order_label_prints_order_id ON public.order_label_prints(order_id);
CREATE INDEX idx_order_label_prints_printed_at ON public.order_label_prints(printed_at);
CREATE INDEX idx_order_label_prints_printed_by_user_id ON public.order_label_prints(printed_by_user_id);

COMMENT ON TABLE public.order_label_prints IS 'Audit log of shipping label prints per order';
COMMENT ON COLUMN public.order_label_prints.order_id IS 'Order whose label was printed';
COMMENT ON COLUMN public.order_label_prints.printed_at IS 'When the label was printed';
COMMENT ON COLUMN public.order_label_prints.printed_by_user_id IS 'User (business) who triggered the print';
