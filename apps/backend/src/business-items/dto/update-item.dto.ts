export class UpdateItemDto {
  name?: string;
  description?: string;
  item_sub_category_id?: number;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  price?: number;
  currency?: string;
  sku?: string | null;
  brand_id?: string | null;
  model?: string | null;
  color?: string | null;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  max_delivery_distance?: number | null;
  estimated_delivery_time?: number | null;
  min_order_quantity?: number;
  max_order_quantity?: number | null;
  is_active?: boolean;
}

