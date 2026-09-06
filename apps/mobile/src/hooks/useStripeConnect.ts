import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { StripeConnectStatusResponse } from '../types/stripe';

type ConnectStatus = NonNullable<StripeConnectStatusResponse['data']>;

/**
 * Loads the user's Stripe Connect status and opens hosted onboarding / the
 * Express dashboard in an auth session, refreshing status on return.
 */
export function useStripeConnect(enabled = true) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (): Promise<ConnectStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.stripe.connectStatus();
      const next = res.data ?? null;
      setStatus(next);
      return next;
    } catch (e: any) {
      setError(e?.message || 'Failed to load Stripe status');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startOnboarding = useCallback(async () => {
    setError(null);
    setActionLoading(true);
    try {
      // Stripe Account Links only accept http(s) return/refresh URLs, so we let
      // the backend point them at the HTTPS web page (platform=mobile) which
      // deep-links back here. The app scheme is only the auth-session dismiss URL.
      const dismissUrl = makeRedirectUri({ path: 'connect/return' });
      const res = await agentApi.stripe.connectAccountLink({ platform: 'mobile' });
      if (res.data?.url) {
        await WebBrowser.openAuthSessionAsync(res.data.url, dismissUrl);
        await fetchStatus();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to start onboarding');
    } finally {
      setActionLoading(false);
    }
  }, [fetchStatus]);

  const openDashboard = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await agentApi.stripe.connectLoginLink();
      if (res.data?.url) {
        await WebBrowser.openBrowserAsync(res.data.url);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to open dashboard');
    } finally {
      setActionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchStatus();
  }, [enabled, fetchStatus]);

  return { status, loading, actionLoading, error, fetchStatus, startOnboarding, openDashboard };
}
