import React from 'react';

/**
 * Web stub: `@stripe/stripe-react-native` (PaymentSheet) is native-only and
 * imports React Native internals that the web bundler cannot compile, so on web
 * we render children without the Stripe provider. Card payments are only
 * available in the native iOS/Android apps.
 */
export function StripeAppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
