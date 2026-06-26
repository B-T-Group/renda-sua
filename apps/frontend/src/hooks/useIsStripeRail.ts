import { StripeConnectStatus, useStripeConnect } from './useStripeConnect';

export interface UseIsStripeRailResult {
  /** True when the user's country routes payments through Stripe. */
  isStripeRail: boolean;
  /** True when the connected Stripe account is active and ready for payouts. */
  stripeReady: boolean;
  loading: boolean;
  status: StripeConnectStatus | null;
}

/**
 * Convenience wrapper around {@link useStripeConnect} that exposes whether the
 * current user is on the Stripe payment rail (vs mobile money) and whether
 * their Connect account is ready for payouts.
 */
export function useIsStripeRail(): UseIsStripeRailResult {
  const { status, loading } = useStripeConnect();

  const isStripeRail = status?.paymentRail === 'stripe';
  const stripeReady =
    !!status?.connected &&
    (status?.status === 'active' ||
      (!!status?.chargesEnabled && !!status?.payoutsEnabled));

  return { isStripeRail, stripeReady, loading, status };
}
