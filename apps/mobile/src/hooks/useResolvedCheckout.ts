/**
 * useResolvedCheckout
 *
 * The single mobile entry point for checkout method resolution.
 *
 * Calls POST /orders/checkout/preflight to get:
 *   - checkout_method (STRIPE | MOBILE_MONEY)
 *   - verification_method (EMAIL | PHONE) for guests
 *   - blocking_errors to show before OTP
 *   - per-seller group payment rails
 *   - payment timing eligibility
 *
 * Do NOT embed payment-rail logic in screens. Consume this hook instead.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import { checkoutAnalytics } from '../services/checkoutAnalytics';
import type {
  CheckoutPreflightRequest,
  CheckoutWizardPhase,
  ResolvedCheckoutConfig,
} from '../types/checkout';

export interface UseResolvedCheckoutResult {
  config: ResolvedCheckoutConfig | null;
  loading: boolean;
  error: string | null;
  /** Re-run the preflight with an updated address or phone. */
  refetch: (overrides?: Partial<CheckoutPreflightRequest>) => Promise<void>;
  /** Quick phase summary for wizard rendering. */
  wizardPhase: CheckoutWizardPhase;
}

export interface UseResolvedCheckoutParams {
  request: CheckoutPreflightRequest | null;
  /** Skip the API call (e.g. while the user is still entering fields). */
  enabled?: boolean;
}

export function useResolvedCheckout(
  params: UseResolvedCheckoutParams
): UseResolvedCheckoutResult {
  const { request, enabled = true } = params;
  const [config, setConfig] = useState<ResolvedCheckoutConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest request identity so stale responses are ignored.
  const requestRef = useRef<string>('');

  const fetch = useCallback(
    async (req: CheckoutPreflightRequest) => {
      const id = JSON.stringify(req);
      requestRef.current = id;
      setLoading(true);
      setError(null);
      try {
        const result = await agentApi.orders.resolveCheckoutPreflight(req);
        if (requestRef.current !== id) return; // stale
        setConfig(result);
        if (result.can_proceed) {
          checkoutAnalytics.checkoutResolved({
            checkout_mode: (req.items?.length ?? 0) > 1 ? 'cart' : 'single',
            checkout_method: result.checkout_method,
            verification_method: result.verification_method,
            item_countries: result.item_countries,
            delivery_country: result.delivery_country,
          });
        } else if (result.blocking_errors?.length) {
          checkoutAnalytics.checkoutBlocked({
            checkout_mode: (req.items?.length ?? 0) > 1 ? 'cart' : 'single',
            blocking_error_code: result.blocking_errors[0]?.code ?? 'UNKNOWN',
            checkout_method: result.checkout_method,
            item_countries: result.item_countries,
            delivery_country: result.delivery_country,
          });
        }
      } catch (e: unknown) {
        if (requestRef.current !== id) return;
        const msg = e instanceof Error ? e.message : 'Could not resolve checkout.';
        setError(msg);
        setConfig(null);
      } finally {
        if (requestRef.current === id) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !request) {
      setConfig(null);
      setLoading(false);
      return;
    }
    void fetch(request);
  }, [enabled, request, fetch]);

  const refetch = useCallback(
    async (overrides?: Partial<CheckoutPreflightRequest>) => {
      if (!request) return;
      await fetch({ ...request, ...overrides });
    },
    [request, fetch]
  );

  const wizardPhase = deriveWizardPhase(config, loading, error);

  return { config, loading, error, refetch, wizardPhase };
}

function deriveWizardPhase(
  config: ResolvedCheckoutConfig | null,
  loading: boolean,
  error: string | null
): CheckoutWizardPhase {
  if (loading || (!config && !error)) return { phase: 'loading' };
  if (error) return { phase: 'error' };
  if (!config) return { phase: 'loading' };

  const blockingErrors = config.blocking_errors ?? [];
  const countryBlocker = blockingErrors.find(
    (e) =>
      e.code === 'UNSUPPORTED_COUNTRY_COMBINATION' ||
      e.code === 'MIXED_COUNTRY_CART' ||
      e.code === 'DELIVERY_COUNTRY_MISMATCH'
  );
  if (countryBlocker) return { phase: 'country_blocked', blockingError: countryBlocker };

  if (!config.can_proceed && blockingErrors.length > 0) {
    return { phase: 'error', blockingError: blockingErrors[0] };
  }

  if (config.requires_address_for_payment && !config.delivery_country) {
    return { phase: 'address' };
  }

  if (config.requires_payment_phone) {
    return { phase: 'phone' };
  }

  return { phase: 'checkout' };
}
