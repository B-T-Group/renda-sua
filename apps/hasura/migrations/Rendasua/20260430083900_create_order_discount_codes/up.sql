CREATE TYPE public.discount_code_type AS ENUM ('first_order_discount_code');

CREATE TABLE public.order_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  discount_type public.discount_code_type NOT NULL,
  created_for_client_id UUID NOT NULL REFERENCES public.clients(id),
  created_for_order_id UUID NOT NULL REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_discount_codes_created_for_client_id
  ON public.order_discount_codes (created_for_client_id);

CREATE INDEX idx_order_discount_codes_created_for_order_id
  ON public.order_discount_codes (created_for_order_id);

CREATE OR REPLACE FUNCTION public.update_order_discount_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_discount_codes_updated_at
  BEFORE UPDATE ON public.order_discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_discount_codes_updated_at();

