-- Add pdf_url to store generated label PDF URL (generate once, reuse on re-print)
ALTER TABLE public.order_label_prints
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN public.order_label_prints.pdf_url IS 'URL of generated shipping label PDF; reused for re-prints';

-- Dedupe: keep one row per order_id (latest printed_at, then latest id)
DELETE FROM public.order_label_prints
WHERE id NOT IN (
  SELECT DISTINCT ON (order_id) id
  FROM public.order_label_prints
  ORDER BY order_id, printed_at DESC, id DESC
);

-- One label record per order; unique constraint enables upsert-style reuse
ALTER TABLE public.order_label_prints
  ADD CONSTRAINT order_label_prints_order_id_key UNIQUE (order_id);
