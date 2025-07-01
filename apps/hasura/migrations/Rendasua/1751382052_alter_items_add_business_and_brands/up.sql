-- 1. Add business_id to items
ALTER TABLE public.items ADD COLUMN business_id UUID;
ALTER TABLE public.items ADD CONSTRAINT fk_items_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE;
CREATE INDEX idx_items_business_id ON public.items(business_id);

-- 2. Create brands table
CREATE TABLE public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
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
CREATE TRIGGER set_public_brands_updated_at
    BEFORE UPDATE ON public.brands
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. Replace brand column in items with nullable brand_id
ALTER TABLE public.items DROP COLUMN brand;
ALTER TABLE public.items ADD COLUMN brand_id UUID NULL;
ALTER TABLE public.items ADD CONSTRAINT fk_items_brand FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE RESTRICT ON DELETE SET NULL;
CREATE INDEX idx_items_brand_id ON public.items(brand_id); 