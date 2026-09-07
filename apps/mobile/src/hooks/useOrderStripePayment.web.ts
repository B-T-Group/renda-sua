export type OrderStripePaymentResult =
  | 'success'
  | 'cancelled'
  | 'failed'
  | 'pending';

export interface OrderStripePaymentOutcome {
  status: OrderStripePaymentResult;
  message?: string;
}

export interface PayWithSheetParams {
  clientSecret: string;
  transactionId?: string | null;
  merchantCountryCode?: string;
}

/**
 * Web stub: the native Stripe PaymentSheet is not available on web. Placing an
 * order via card must be done from the native iOS/Android app. The Place Order
 * screen does not request a PaymentSheet on web, so `pay` is never invoked here
 * in practice; it returns `failed` defensively.
 */
export function useOrderStripePayment() {
  return {
    pay: async (_params: PayWithSheetParams): Promise<OrderStripePaymentOutcome> => ({
      status: 'failed',
      message: 'Card payment is only available in the mobile app.',
    }),
    loading: false,
    error: 'Card payment is only available in the mobile app.',
  };
}
