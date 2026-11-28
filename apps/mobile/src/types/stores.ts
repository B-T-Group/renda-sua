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
  is_partner?: boolean;
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

/** A seller (business location) in the Exports seller directory. */
export interface ExportSeller extends CatalogStore {
  /** ISO-2 country of the location. */
  country: string | null;
  /** Newest live export listing in the current context (ISO). */
  latest_export_at: string | null;
}

export interface ExportSellersPage {
  stores: ExportSeller[];
  /** Sellers matching the context and search, before limit / offset. */
  total: number;
  /** Context country: origin (From) or viewer market (Into). */
  country: string | null;
}

export interface ExportSellersEnvelope {
  success: boolean;
  data: ExportSellersPage;
  message: string;
}
