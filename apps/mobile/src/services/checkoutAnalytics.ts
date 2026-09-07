/**
 * Checkout Analytics
 *
 * Thin adapter for standardized checkout event tracking.
 *
 * Wire this to your analytics backend (Amplitude, Segment, Mixpanel, etc.)
 * by replacing the `record` implementation below. All checkout code should
 * call these typed functions rather than the raw analytics SDK so event names
 * and property shapes stay consistent.
 *
 * Usage:
 *   checkoutAnalytics.checkoutStarted({ checkout_mode: 'single', item_countries: ['CM'] });
 *   checkoutAnalytics.checkoutResolved({ checkout_method: 'MOBILE_MONEY', ... });
 */
import type { CheckoutMethod, VerificationMethod } from '../types/checkout';

// ---------------------------------------------------------------------------
// Event properties
// ---------------------------------------------------------------------------

export type CheckoutMode = 'single' | 'cart';

export interface CheckoutBaseProps {
  checkout_mode: CheckoutMode;
  /** ISO 3166-1 alpha-2 countries of items in this checkout. */
  item_countries?: string[];
  delivery_country?: string | null;
  cart_country_count?: number;
}

export interface CheckoutResolvedProps extends CheckoutBaseProps {
  checkout_method: CheckoutMethod;
  verification_method: VerificationMethod;
  provider?: string | null;
}

export interface CheckoutBlockedProps extends CheckoutBaseProps {
  blocking_error_code: string;
  checkout_method?: CheckoutMethod;
}

export interface GuestVerificationProps {
  verification_method: VerificationMethod;
  checkout_mode: CheckoutMode;
}

export interface CheckoutPaymentProps extends CheckoutBaseProps {
  checkout_method: CheckoutMethod;
  provider?: string | null;
}

export interface CheckoutOrderCreatedProps extends CheckoutBaseProps {
  checkout_method: CheckoutMethod;
  order_count: number;
  order_ids: string[];
}

export interface CheckoutFailedProps extends CheckoutBaseProps {
  error_message: string;
  error_code?: string;
  checkout_method?: CheckoutMethod;
}

/** Delivery availability funnel ù reason-blind on the client by design. */
export interface DeliveryAvailabilityFunnelProps {
  checkout_mode: CheckoutMode;
}

// ---------------------------------------------------------------------------
// Record function ù replace this with your analytics SDK call
// ---------------------------------------------------------------------------

function record(eventName: string, props: Record<string, unknown>): void {
  // TODO: Wire to Segment, Amplitude, Mixpanel, Firebase Analytics, etc.
  // Example: analytics.track(eventName, props);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[CheckoutAnalytics]', eventName, props);
  }
}

// ---------------------------------------------------------------------------
// Typed event emitters
// ---------------------------------------------------------------------------

export const checkoutAnalytics = {
  checkoutStarted(props: CheckoutBaseProps): void {
    record('checkout_started', props as unknown as Record<string, unknown>);
  },

  checkoutResolved(props: CheckoutResolvedProps): void {
    record('checkout_resolved', props as unknown as Record<string, unknown>);
  },

  checkoutBlocked(props: CheckoutBlockedProps): void {
    record('checkout_blocked', props as unknown as Record<string, unknown>);
  },

  guestVerificationStarted(props: GuestVerificationProps): void {
    record('guest_verification_started', props as unknown as Record<string, unknown>);
  },

  guestVerificationCompleted(props: GuestVerificationProps): void {
    record('guest_verification_completed', props as unknown as Record<string, unknown>);
  },

  checkoutAddressSelected(props: CheckoutBaseProps & { address_country?: string }): void {
    record('checkout_address_selected', props as unknown as Record<string, unknown>);
  },

  checkoutPaymentStarted(props: CheckoutPaymentProps): void {
    record('checkout_payment_started', props as unknown as Record<string, unknown>);
  },

  checkoutPaymentPending(props: CheckoutPaymentProps): void {
    record('checkout_payment_pending', props as unknown as Record<string, unknown>);
  },

  checkoutPaymentCompleted(props: CheckoutPaymentProps): void {
    record('checkout_payment_completed', props as unknown as Record<string, unknown>);
  },

  checkoutOrderCreated(props: CheckoutOrderCreatedProps): void {
    record('checkout_order_created', props as unknown as Record<string, unknown>);
  },

  checkoutFailed(props: CheckoutFailedProps): void {
    record('checkout_failed', props as unknown as Record<string, unknown>);
  },

  // Delivery availability funnel:
  // delivery_unavailable_shown -> switched_to_pickup -> order_created_pickup
  deliveryUnavailableShown(props: DeliveryAvailabilityFunnelProps): void {
    record('delivery_unavailable_shown', props as unknown as Record<string, unknown>);
  },

  switchedToPickup(props: DeliveryAvailabilityFunnelProps): void {
    record('switched_to_pickup', props as unknown as Record<string, unknown>);
  },

  orderCreatedPickup(
    props: DeliveryAvailabilityFunnelProps & { order_count: number }
  ): void {
    record('order_created_pickup', props as unknown as Record<string, unknown>);
  },
};
