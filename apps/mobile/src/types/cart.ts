/** One persisted cart line (aligned with web `CartItem`). */
export interface CartLine {
  inventoryItemId: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  businessId: string;
  businessLocationId: string;
  /** Seller display name at add time */
  businessName?: string;
  /**
   * ISO 3166-1 alpha-2 country code of the seller's primary business location.
   * Snapshotted at add time so country validation can run without refetching
   * item details. Old cart lines (before this field) will have undefined here;
   * CartStore treats them as requiring revalidation.
   */
  sellerCountry?: string;
  itemData: {
    name: string;
    price: number;
    currency: string;
    imageUrl?: string;
    maxOrderQuantity?: number;
    minOrderQuantity?: number;
    /** From catalog at add time; used for cart checkout payment options. */
    payOnDeliveryEnabled?: boolean;
    /** False when merchant is visible but not yet accepting orders. Undefined on legacy cart lines. */
    merchantCanAcceptOrders?: boolean;
  };
}

/** Cart-level country validation result. */
export type CartCountryStatus =
  | 'ok'
  | 'mixed_countries'
  | 'stale_metadata'
  | 'unknown';

export interface CartCountryInfo {
  status: CartCountryStatus;
  countries: string[];
  /** True when at least one line is missing sellerCountry (pre-migration line). */
  hasStalLines: boolean;
}
