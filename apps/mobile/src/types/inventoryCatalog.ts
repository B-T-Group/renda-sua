/** Public catalog row from GET /inventory-items (aligned with web `InventoryItem`). */
import type {
  InventoryVariantPriceOverride,
  ItemVariant,
} from './business/itemVariant';
import type { FoodAvailability } from './food';

export type InventorySortMode = 'relevance' | 'fastest' | 'cheapest' | 'top_rated' | 'deals';

export interface CatalogInventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  computed_available_quantity: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  viewsCount?: number;
  likes_count?: number;
  liked?: boolean;
  hasActiveDeal?: boolean;
  original_price?: number;
  discounted_price?: number;
  variant_price_overrides?: InventoryVariantPriceOverride[];
  deal_end_at?: string;
  /** False when MoMo location phone is missing or unverified. */
  payments_enabled?: boolean;
  distance_text?: string;
  duration_text?: string;
  avg_rating?: number | null;
  rating_count?: number | null;
  /** Present only for items in the cooked-food category. */
  food_availability?: FoodAvailability | null;
  item: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    weight: number;
    weight_unit: string;
    sku: string;
    brand: { id: string; name: string };
    model: string;
    color: string;
    min_order_quantity: number;
    max_order_quantity: number;
    is_active: boolean;
    /** Minutes; from GET /inventory-items/:id */
    estimated_delivery_time?: number;
    /** Typical minutes to cook the dish (cooked food only). */
    preparation_minutes?: number | null;
    pay_on_delivery_enabled?: boolean;
    interest_only?: boolean;
    dimensions?: string | null;
    is_fragile?: boolean;
    is_perishable?: boolean;
    is_used?: boolean;
    requires_special_handling?: boolean;
    max_delivery_distance?: number;
    pay_at_pickup_enabled?: boolean;
    shipping_enabled?: boolean;
    shipping_price?: number | null;
    shipping_currency?: string;
    item_variants?: ItemVariant[];
    item_sub_category: {
      id: number;
      name: string;
      item_category: { id: number; name: string };
    };
    item_images: Array<{
      id: string;
      image_url: string;
      display_order: number;
      /** Generated thumbnail URL when ready, else null. */
      thumbnail?: string | null;
      thumbnail_status?: string | null;
      /** Server-resolved display URL: thumbnail when ready, else image_url. */
      display_url?: string | null;
    }>;
  };
  business_location: {
    id: string;
    business_id: string;
    name: string;
    location_type: string;
    is_primary: boolean;
    logo_url?: string | null;
    business: {
      id: string;
      name: string;
      is_verified: boolean;
      can_accept_orders?: boolean;
      is_storefront_visible?: boolean;
      lifecycle_status?: string;
    };
    address: {
      id: string;
      address_line_1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface PaginatedCatalogInventory {
  items: CatalogInventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryItemsApiEnvelope {
  success: boolean;
  data: PaginatedCatalogInventory;
  message: string;
}

export interface InventoryItemByIdEnvelope {
  success: boolean;
  data: CatalogInventoryItem;
  message: string;
}
