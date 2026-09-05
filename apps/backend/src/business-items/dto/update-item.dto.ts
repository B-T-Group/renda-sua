export class UpdateItemDto {
  name?: string;
  description?: string;
  item_sub_category_id?: number;
  /** Resolve or create subcategory from names (alternative to item_sub_category_id). */
  categoryName?: string;
  subCategoryName?: string;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  price?: number | null;
  currency?: string;
  sku?: string | null;
  brand_id?: string | null;
  /** Resolve or create brand from name (alternative to brand_id). */
  brandName?: string;
  model?: string | null;
  color?: string | null;
  is_fragile?: boolean;
  is_perishable?: boolean;
  /** True when the item is used / pre-owned (not new). */
  is_used?: boolean;
  requires_special_handling?: boolean;
  max_delivery_distance?: number | null;
  estimated_delivery_time?: number | null;
  /** Typical minutes to cook the dish (cooked food only). */
  preparation_minutes?: number | null;
  min_order_quantity?: number;
  max_order_quantity?: number | null;
  is_active?: boolean;
  pay_on_delivery_enabled?: boolean;
  interest_only?: boolean;
  pay_at_pickup_enabled?: boolean;
  shipping_enabled?: boolean;
  shipping_price?: number | null;
  shipping_currency?: string;
  stripe_tax_code_id?: string;
}

