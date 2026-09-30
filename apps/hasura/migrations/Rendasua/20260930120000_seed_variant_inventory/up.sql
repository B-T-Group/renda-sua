-- Copy each item-level inventory row onto that item's active variants.
-- quantity and reserved_quantity start equal to the parent so available stock matches.
-- Purchases of a variant then decrement the variant row, not the parent.

INSERT INTO public.business_inventory (
  business_location_id,
  item_id,
  item_variant_id,
  quantity,
  reserved_quantity,
  selling_price,
  unit_cost,
  reorder_point,
  reorder_quantity,
  is_active
)
SELECT
  parent.business_location_id,
  parent.item_id,
  variant.id,
  parent.quantity,
  parent.reserved_quantity,
  parent.selling_price,
  parent.unit_cost,
  parent.reorder_point,
  parent.reorder_quantity,
  parent.is_active
FROM public.business_inventory parent
JOIN public.item_variants variant
  ON variant.item_id = parent.item_id
 AND variant.is_active = true
WHERE parent.item_variant_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_inventory existing
    WHERE existing.business_location_id = parent.business_location_id
      AND existing.item_id = parent.item_id
      AND existing.item_variant_id = variant.id
  );
