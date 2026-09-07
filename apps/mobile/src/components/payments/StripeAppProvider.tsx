import React, { useEffect, useState } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getEnv } from '../../config/auth0';
import { registerEnvChangeListener } from '../../config/envSwitch';
import { publicApiGet } from '../../services/publicApiClient';
import type { StripeClientConfigResponse } from '../../types/stripe';

function fallbackPublishableKey(): string {
  return getEnv().stripePublishableKey;
}

/**
 * Wraps the app with the native Stripe provider.
 * Prefers the backend `GET /stripe-payments/config` publishable key so PaymentSheet
 * always matches PaymentIntents created by the active API environment.
 *
 * Must only mount after RootStore env hydrate (see App.tsx) so DEVELOPMENT never
 * hits prod.api on cold start.
 */
export function StripeAppProvider({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState(fallbackPublishableKey);

  useEffect(() => {
    let cancelled = false;

    async function loadKey() {
      const fallback = fallbackPublishableKey();
      if (!cancelled) setPublishableKey(fallback);
      try {
        const res = await publicApiGet<StripeClientConfigResponse>(
          '/stripe-payments/config'
        );
        const key = res.data?.publishableKey?.trim();
        if (!cancelled && key) setPublishableKey(key);
      } catch {
        // Keep env fallback when the API is unreachable or route not yet deployed.
      }
    }

    void loadKey();
    return registerEnvChangeListener(() => {
      void loadKey();
    });
  }, []);

  // No `merchantIdentifier`: Apple Pay is disabled for now and providing it
  // would require the Apple Pay entitlement in the provisioning profile.
  return (
    <StripeProvider publishableKey={publishableKey} urlScheme="rendasua">
      {children}
    </StripeProvider>
  );
}
