CREATE TABLE public.business_item_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_item_favorites_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT business_item_favorites_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT business_item_favorites_business_id_item_id_key UNIQUE (business_id, item_id)
);

CREATE INDEX business_item_favorites_business_id_idx
  ON public.business_item_favorites (business_id);
CREATE INDEX business_item_favorites_item_id_idx
  ON public.business_item_favorites (item_id);
