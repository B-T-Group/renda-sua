export interface ItemFormCategory {
  id: number;
  name: string;
  item_sub_categories: ItemFormSubCategory[];
}

export interface ItemFormSubCategory {
  id: number;
  name: string;
  item_category_id: number;
}

export interface ItemFormBrand {
  id: string;
  name: string;
}

export interface ItemFormTag {
  id: string;
  name: string;
}

export interface BusinessItemDetail {
  id: string;
  name: string;
  description?: string | null;
  item_sub_category_id?: number | null;
  price?: number;
  currency?: string;
  sku?: string | null;
  brand_id?: string | null;
  model?: string | null;
  color?: string | null;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number | null;
  is_active?: boolean;
  pay_on_delivery_enabled?: boolean;
  pay_at_pickup_enabled?: boolean;
  shipping_enabled?: boolean;
  shipping_price?: number | null;
  shipping_currency?: string;
  stripe_tax_code_id?: string | null;
  brand?: ItemFormBrand | null;
  item_sub_category?: {
    id: number;
    name: string;
    item_category?: { id: number; name: string };
  } | null;
  item_tags?: Array<{ tag_id: string; tag: ItemFormTag }>;
}

export interface BusinessItemFormValues {
  name: string;
  description: string;
  price: string;
  currency: string;
  item_sub_category_id: number | null;
  categoryId: number | null;
  brand_id: string | null;
  model: string;
  sku: string;
  weight: string;
  weight_unit: string;
  dimensions: string;
  is_fragile: boolean;
  is_perishable: boolean;
  requires_special_handling: boolean;
  pay_on_delivery_enabled: boolean;
  min_order_quantity: string;
  max_order_quantity: string;
  is_active: boolean;
}
