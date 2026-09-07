import { PaymentSheetError, useStripe } from '@stripe/stripe-react-native';
import { useCallback, useState } from 'react';
import { agentApi } from '../services/agentApi';

export type OrderStripePaymentResult =
  | 'success'
  | 'authorized'
  | 'cancelled'
  | 'failed'
  | 'pending';

export interface OrderStripePaymentOutcome {
  status: OrderStripePaymentResult;
  /** Stripe / network message when status is `failed`. */
  message?: string;
}

export interface PayWithSheetParams {
  clientSecret: string;
  /** Stripe transaction id used to confirm backend finalization after payment. */
  transactionId?: string | null;
  /** ISO alpha-2 country reserved for Google Pay / Apple Pay (wallets disabled for now). */
  merchantCountryCode?: string;
}

const STATUS_POLLS = 6;
const STATUS_INTERVAL_MS = 2000;

/**
 * Presents the native Stripe PaymentSheet for an order PaymentIntent and, on a
 * successful card payment, polls the backend transaction until the
 * authorization or capture webhook has finalized the order.
 */
export function useOrderStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmStatus = useCallback(
    async (transactionId: string): Promise<OrderStripePaymentOutcome> => {
      for (let i = 0; i < STATUS_POLLS; i += 1) {
        const res = await agentApi.stripe.transactionStatus(transactionId);
        const status = res.data?.status;
        if (status === 'success') return { status: 'success' };
        if (status === 'authorized' || status === 'capture_pending') {
          return { status: 'authorized' };
        }
        if (status === 'failed' || status === 'cancelled' || status === 'expired') {
          return {
            status: 'failed',
            message: `Payment ${status}. Please try again.`,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, STATUS_INTERVAL_MS));
      }
      return { status: 'pending' };
    },
    []
  );

  const pay = useCallback(
    async (params: PayWithSheetParams): Promise<OrderStripePaymentOutcome> => {
      setLoading(true);
      setError(null);
      try {
        // Google Pay / Apple Pay intentionally disabled for now (card only).
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Rendasua',
          paymentIntentClientSecret: params.clientSecret,
          allowsDelayedPaymentMethods: false,
          returnURL: 'rendasua://payment/return',
        });
        if (initError) {
          setError(initError.message);
          return { status: 'failed', message: initError.message };
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === PaymentSheetError.Canceled) {
            return { status: 'cancelled' };
          }
          setError(presentError.message);
          return { status: 'failed', message: presentError.message };
        }

        // Paid client-side; confirm the backend webhook finalized the order.
        if (params.transactionId) {
          return confirmStatus(params.transactionId);
        }
        return { status: 'success' };
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Payment error';
        setError(message);
        return { status: 'failed', message };
      } finally {
        setLoading(false);
      }
    },
    [initPaymentSheet, presentPaymentSheet, confirmStatus]
  );

  return { pay, loading, error };
}
