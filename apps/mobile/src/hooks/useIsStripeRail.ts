import { useCallback } from 'react';
import { useStripeConnect } from './useStripeConnect';
import type { StripeConnectStatusResponse } from '../types/stripe';

type StripeConnectStatus = NonNullable<StripeConnectStatusResponse['data']>;

export interface UseIsStripeRailResult {
  /** True when the user's country routes payments through Stripe (vs mobile money). */
  isStripeRail: boolean;
  /** True when the connected Stripe account is active and ready for payouts. */
  stripeReady: boolean;
  loading: boolean;
  /** Raw connect status; null while loading or if the request failed. */
  status: StripeConnectStatus | null;
  /** Refetch connect status; resolves to whether the user is on the Stripe rail. */
  refetch: () => Promise<boolean>;
}

/**
 * Mirrors the web `useIsStripeRail`: derives whether the current user is on the
 * Stripe payment rail from `GET /stripe-connect/status` (resolved server-side
 * from the user's address country).
 */
export function useIsStripeRail(enabled = true): UseIsStripeRailResult {
  const { status, loading, fetchStatus } = useStripeConnect(enabled);

  const isStripeRail = status?.paymentRail === 'stripe';
  const stripeReady =
    !!status?.connected &&
    (status?.status === 'active' ||
      (!!status?.chargesEnabled && !!status?.payoutsEnabled));

  const refetch = useCallback(async (): Promise<boolean> => {
    const next = await fetchStatus();
    return next?.paymentRail === 'stripe';
  }, [fetchStatus]);

  return { isStripeRail, stripeReady, loading, status, refetch };
}
