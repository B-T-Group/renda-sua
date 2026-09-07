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
