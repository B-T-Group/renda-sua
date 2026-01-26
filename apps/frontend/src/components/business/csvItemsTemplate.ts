/**
 * Shared CSV template for items + inventory (upload template and download export).
 * Headers must match exactly so download matches the template.
 */
export const CSV_ITEMS_TEMPLATE_HEADERS = [
  'name',
  'description',
  'price',
  'currency',
  'sku',
  'weight',
  'weight_unit',
  'dimensions',
  'color',
  'model',
  'is_fragile',
  'is_perishable',
  'requires_special_handling',
  'min_order_quantity',
  'max_order_quantity',
  'is_active',
  'item_sub_category_id',
  'brand_id',
  'business_location_name',
  'quantity',
  'reserved_quantity',
  'reorder_point',
  'reorder_quantity',
  'unit_cost',
  'selling_price',
  'image_url',
  'image_alt_text',
  'image_caption',
] as const;

export type CsvItemsTemplateHeader = (typeof CSV_ITEMS_TEMPLATE_HEADERS)[number];
