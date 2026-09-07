import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { InitiateStripePaymentBody } from '../types/stripe';

export type StripeCheckoutResult =
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'pending';

const STATUS_POLLS = 6;
const STATUS_INTERVAL_MS = 2000;

/**
 * Opens a Stripe hosted Checkout in an auth session and confirms the resulting
 * payment status once the user returns to the app via the deep link.
 */
export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmStatus = useCallback(
    async (transactionId: string): Promise<StripeCheckoutResult> => {
      for (let i = 0; i < STATUS_POLLS; i += 1) {
        const res = await agentApi.stripe.transactionStatus(transactionId);
        const status = res.data?.status;
        if (status && status !== 'pending') {
          return status;
        }
        await new Promise((resolve) => setTimeout(resolve, STATUS_INTERVAL_MS));
      }
      return 'pending';
    },
    []
  );

  const pay = useCallback(
    async (body: InitiateStripePaymentBody): Promise<StripeCheckoutResult> => {
      setLoading(true);
      setError(null);
      try {
        const returnUrl = makeRedirectUri({ path: 'payment/return' });
        const res = await agentApi.stripe.initiate({
          ...body,
          successUrl: returnUrl,
          cancelUrl: returnUrl,
        });
        const url = res.data?.paymentUrl;
        const transactionId = res.data?.transactionId;
        if (!res.success || !url || !transactionId) {
          setError(res.message || 'Failed to start checkout');
          return 'failed';
        }
        await WebBrowser.openAuthSessionAsync(url, returnUrl);
        return confirmStatus(transactionId);
      } catch (e: any) {
        setError(e?.message || 'Checkout error');
        return 'failed';
      } finally {
        setLoading(false);
      }
    },
    [confirmStatus]
  );

  return { pay, loading, error };
}
