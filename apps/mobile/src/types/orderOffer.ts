/**
 * Types for the push-based delivery offer flow (backend /orders/:id/offer and
 * /orders/offer/accept|decline). Mirrors the backend OfferDetailsResponse.
 */

export type OrderOfferKind = 'standard' | 'dedicated';

export interface OrderOfferPickup {
  businessName: string | null;
  /** #594 G3: business location name; null when the location has none. */
  locationName?: string | null;
  city: string | null;
  state: string | null;
}

export interface OrderOfferDropoff {
  city: string | null;
  state: string | null;
}

export interface OrderOfferDetails {
  orderId: string;
  orderNumber: string;
  expiresAt: string;
  /** Full offer window in seconds. Remaining time is derived from expiresAt. */
  ttlSeconds?: number;
  distanceKm: number | null;
  estimatedEarnings: number | null;
  currency: string | null;
  estimatedDeliveryMinutes: number | null;
  pickup: OrderOfferPickup;
  dropoff: OrderOfferDropoff;
  /** #594 G3: 'dedicated' when offered to a store's dedicated agent. */
  offerKind?: OrderOfferKind;
}

export interface OrderOfferResponse {
  success: boolean;
  active: boolean;
  offer: OrderOfferDetails | null;
}
