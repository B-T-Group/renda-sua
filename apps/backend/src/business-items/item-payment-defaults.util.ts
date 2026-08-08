import type { PaymentRail } from '../stripe-payments/payment-routing.service';

/**
 * Default pay-at-delivery for new catalog items.
 * Mobile-money markets: on by default (cash/COD trust). Stripe: off.
 * Explicit client values always win.
 */
export function resolvePayOnDeliveryDefault(
  rail: PaymentRail,
  explicit?: boolean | null
): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return rail === 'mobile_money';
}
