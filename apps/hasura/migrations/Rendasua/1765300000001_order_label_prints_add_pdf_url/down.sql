ALTER TABLE public.order_label_prints
  DROP CONSTRAINT IF EXISTS order_label_prints_order_id_key;

ALTER TABLE public.order_label_prints
  DROP COLUMN IF EXISTS pdf_url;
