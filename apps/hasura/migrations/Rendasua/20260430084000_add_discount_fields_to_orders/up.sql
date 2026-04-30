ALTER TABLE public.orders
  ADD COLUMN discount_code_id UUID REFERENCES public.order_discount_codes(id),
  ADD COLUMN discount_amount NUMERIC(10,2);

CREATE INDEX idx_orders_discount_code_id
  ON public.orders (discount_code_id);

