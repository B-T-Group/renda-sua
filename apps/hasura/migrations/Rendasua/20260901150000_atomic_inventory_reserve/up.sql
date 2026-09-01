-- Atomic reserve/release for business_inventory.reserved_quantity

ALTER TABLE public.business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_reserved_quantity_bounds;

ALTER TABLE public.business_inventory
  ADD CONSTRAINT business_inventory_reserved_quantity_bounds
  CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity);

CREATE OR REPLACE FUNCTION public.try_reserve_business_inventory(
  p_inventory_id uuid,
  p_qty integer
)
RETURNS SETOF public.business_inventory
LANGUAGE sql
VOLATILE
AS $$
  UPDATE public.business_inventory
  SET
    reserved_quantity = reserved_quantity + p_qty,
    updated_at = now()
  WHERE id = p_inventory_id
    AND p_qty > 0
    AND quantity - reserved_quantity >= p_qty
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.try_release_business_inventory(
  p_inventory_id uuid,
  p_qty integer
)
RETURNS SETOF public.business_inventory
LANGUAGE sql
VOLATILE
AS $$
  UPDATE public.business_inventory
  SET
    reserved_quantity = reserved_quantity - p_qty,
    updated_at = now()
  WHERE id = p_inventory_id
    AND p_qty > 0
    AND reserved_quantity >= p_qty
  RETURNING *;
$$;

COMMENT ON FUNCTION public.try_reserve_business_inventory IS
  'Atomically increment reserved_quantity when sufficient stock is available';

COMMENT ON FUNCTION public.try_release_business_inventory IS
  'Atomically decrement reserved_quantity without going negative';
