export type ReorderSkipReason =
  | 'unavailable'
  | 'out_of_stock'
  | 'variant_unavailable'
  | 'not_orderable';

export type ReorderNavigationHint = 'checkout' | 'cart' | 'none';

export type ReorderFulfillmentType = 'delivery' | 'pickup' | 'shipping';

export type ReorderItemData = {
  name: string;
  price: number;
  currency: string;
  image_url?: string | null;
  max_order_quantity?: number | null;
  min_order_quantity?: number | null;
  pay_on_delivery_enabled?: boolean | null;
  business_name?: string | null;
  seller_country?: string | null;
  merchant_can_accept_orders?: boolean | null;
};

export type ReorderLine = {
  business_inventory_id: string;
  item_id: string;
  item_variant_id?: string | null;
  quantity: number;
  ordered_quantity: number;
  variant_name?: string | null;
  business_location_id: string;
  item_data: ReorderItemData;
};

export type ReorderSkipped = {
  name: string;
  reason: ReorderSkipReason;
};

export type ReorderOrderResponse = {
  business_id: string;
  lines: ReorderLine[];
  skipped: ReorderSkipped[];
  fulfillment: {
    type: ReorderFulfillmentType;
    address_id?: string | null;
    address_valid: boolean;
    business_accepting_orders: boolean;
  };
  navigation_hint: ReorderNavigationHint;
};

export type ReorderCartAction = 'replace' | 'add' | 'blocked_other_store';
