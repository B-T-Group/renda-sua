import type { RentalStripeFlowResult } from '../../hooks/useRentalStripePayment';

type Translate = (key: string, fallback: string) => string;

/** Snackbar copy after card Pay & start; null when the booking already started and needs no message. */
export function pickupCardOutcomeMessage(outcome: RentalStripeFlowResult, started: boolean, t: Translate): string | null {
  if (outcome === 'cancelled') {
    return t('rentals.payAtPickup.cardCancelled', 'Payment cancelled. Nothing was charged. You can try again.');
  }
  if (outcome === 'failed') {
    return t('rentals.payAtPickup.cardFailed', 'Card payment didn’t go through. Try again or use another card.');
  }
  if (outcome === 'none') {
    return started ? null : t('rentals.payAtPickup.cardUnavailable', 'We couldn’t open the card payment. Nothing was charged. Try again.');
  }
  return t('rentals.payAtPickup.cardConfirming', 'Payment received. Starting your rental…');
}
