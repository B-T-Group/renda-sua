import { useStripe } from '@stripe/stripe-react-native';
import { Linking } from 'react-native';
import type { CreateRentalBookingResult } from '../types/rentals';
import {
  useOrderStripePayment,
  type OrderStripePaymentOutcome,
  type OrderStripePaymentResult,
  type PayWithSheetParams,
} from './useOrderStripePayment';

export type RentalStripeFlowResult =
  | 'none'
  | 'success'
  | 'authorized'
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'browser';

/**
 * After book/retry, present PaymentSheet when the API returns a client secret,
 * or open hosted Checkout as a fallback (orders parity).
 */
export async function settleRentalStripePayment(
  res: CreateRentalBookingResult,
  pay: (params: PayWithSheetParams) => Promise<OrderStripePaymentOutcome>
): Promise<RentalStripeFlowResult> {
  if (res.payment_rail !== 'stripe' || res.confirmed) return 'none';
  const secret = res.payment_intent_client_secret;
  if (secret) {
    const outcome = await pay({
      clientSecret: secret,
      transactionId: res.payment_transaction_id,
    });
    return outcome.status as OrderStripePaymentResult;
  }
  if (res.checkout_url) {
    await Linking.openURL(res.checkout_url);
    return 'browser';
  }
  return 'none';
}

export function useRentalStripePayment() {
  return useOrderStripePayment();
}

/** Completes a bank step-up on an off-session PaymentIntent. */
export function useRentalNextAction() {
  const { handleNextAction } = useStripe();
  return async (clientSecret: string): Promise<boolean> => {
    const result = await handleNextAction(clientSecret);
    return !result.error;
  };
}

/** Saves a card with a SetupIntent. Nothing is charged. */
export function useRentalCardSetup() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  return async (clientSecret: string): Promise<boolean> => {
    const ready = await initPaymentSheet({
      merchantDisplayName: 'Rendasua',
      setupIntentClientSecret: clientSecret,
      returnURL: 'rendasua://payment/return',
    });
    if (ready.error) return false;
    const presented = await presentPaymentSheet();
    return !presented.error;
  };
}
