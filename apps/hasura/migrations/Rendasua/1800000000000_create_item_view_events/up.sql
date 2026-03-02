CREATE TABLE public.item_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  viewer_type text NOT NULL,
  viewer_id text NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_view_events
  ADD CONSTRAINT item_view_events_inventory_item_id_fkey
  FOREIGN KEY (inventory_item_id)
  REFERENCES public.business_inventory (id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE public.item_view_events
  ADD CONSTRAINT item_view_events_inventory_item_id_viewer_type_viewer_id_key
  UNIQUE (inventory_item_id, viewer_type, viewer_id);

CREATE INDEX item_view_events_inventory_item_id_last_viewed_at_idx
  ON public.item_view_events (inventory_item_id, last_viewed_at);

