export interface CatalogStore {
  business_location_id: string;
  business_id: string;
  name: string;
  city?: string | null;
  logo_url: string | null;
  item_count: number;
  is_verified: boolean;
  can_accept_orders: boolean;
  is_storefront_visible: boolean;
  distance_meters?: number | null;
}

export interface CatalogStoresEnvelope {
  success: boolean;
  data: { stores: CatalogStore[] };
  message: string;
}

export interface CatalogStoreEnvelope {
  success: boolean;
  data: { store: CatalogStore };
  message: string;
}
