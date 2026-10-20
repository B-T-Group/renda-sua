/**
 * Types for the push-based delivery offer flow (backend /orders/:id/offer and
 * /orders/offer/accept|decline). Mirrors the backend OfferDetailsResponse.
 */

export interface OrderOfferPickup {
  businessName: string | null;
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
}

export interface OrderOfferResponse {
  success: boolean;
  active: boolean;
  offer: OrderOfferDetails | null;
}
