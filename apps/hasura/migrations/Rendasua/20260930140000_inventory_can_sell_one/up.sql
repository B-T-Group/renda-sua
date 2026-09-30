CREATE OR REPLACE FUNCTION public.inventory_can_sell_one(business_inventory_row public.business_inventory)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN business_inventory_row.item_variant_id IS NULL THEN
      (business_inventory_row.quantity - COALESCE(business_inventory_row.reserved_quantity, 0)) > 0
    ELSE EXISTS (
      SELECT 1
      FROM public.item_variants iv
      WHERE iv.id = business_inventory_row.item_variant_id
        AND iv.is_active IS DISTINCT FROM false
        AND (business_inventory_row.quantity - COALESCE(business_inventory_row.reserved_quantity, 0))
            >= iv.quantity
    )
  END;
$$;

COMMENT ON FUNCTION public.inventory_can_sell_one(public.business_inventory) IS
  'True when this row has enough base units for one sale of its option.';
