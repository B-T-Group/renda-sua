-- Remove seeded item images
DELETE FROM public.item_images WHERE item_id IN (SELECT id FROM public.items WHERE sku LIKE 'FB-%' OR sku LIKE 'RS-%' OR sku LIKE 'HB-%' OR sku LIKE 'SV-%' OR sku LIKE 'IB-%');

-- Remove seeded items
DELETE FROM public.items WHERE sku LIKE 'FB-%' OR sku LIKE 'RS-%' OR sku LIKE 'HB-%' OR sku LIKE 'SV-%' OR sku LIKE 'IB-%';
