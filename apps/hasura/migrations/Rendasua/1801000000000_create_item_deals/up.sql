CREATE TABLE public.item_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_deals
  ADD CONSTRAINT item_deals_inventory_item_id_fkey
  FOREIGN KEY (inventory_item_id)
  REFERENCES public.business_inventory (id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE INDEX item_deals_inventory_item_id_active_window_idx
  ON public.item_deals (inventory_item_id, is_active, start_at, end_at);

