/** Designated agent first: `GET /orders/designated/mine`. */
export interface DesignatedOfferDetails {
  date: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  gateAt: string | null;
  businessName: string;
  pickupArea: string;
  dropoffArea: string;
  pickupKm: number | null;
  dropoffKm: number | null;
  distanceOrigin: 'gps' | 'home' | null;
  commission: number | null;
  currency: string | null;
  releaseCutoffAt: string | null;
}

export interface DesignatedOffer {
  orderId: string;
  phase: string;
  expiresAt: string;
  offeredAt: string;
  estimatedEarnings: number | null;
  currency: string | null;
  details: DesignatedOfferDetails | null;
  /** Ignore on Home only; hub still shows the card for planning. */
  dismissedFromHome?: boolean;
}

export interface DesignatedUpcoming {
  orderId: string;
  orderNumber: string;
  storeName: string | null;
  date: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  pickupBy: string | null;
  gateAt: string | null;
  releaseCutoffAt: string | null;
  freeRelease: boolean;
  confirmedAt: string | null;
}

export interface DesignatedMineResponse {
  success: boolean;
  offers: DesignatedOffer[];
  upcoming: DesignatedUpcoming[];
}
