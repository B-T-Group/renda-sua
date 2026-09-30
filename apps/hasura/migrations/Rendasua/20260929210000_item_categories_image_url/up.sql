ALTER TABLE public.item_categories
  ADD COLUMN IF NOT EXISTS image_url text;
