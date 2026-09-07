import { useEffect, useMemo, useState } from 'react';
import { useBusinessVerificationStatus } from './useBusinessVerificationStatus';
import { useNotificationPermission } from './useNotificationPermission';
import { useNotificationPreferences } from './useNotificationPreferences';
import { agentApi } from '../services/agentApi';

export function useBusinessReachability(enabled: boolean) {
  const verification = useBusinessVerificationStatus(enabled);
  const permission = useNotificationPermission();
  const preferences = useNotificationPreferences();
  const [tokenLoading, setTokenLoading] = useState(enabled);
  const [hasRegisteredPushTokens, setHasRegisteredPushTokens] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    if (!enabled) {
      setTokenLoading(false);
      setHasRegisteredPushTokens(null);
      return;
    }
    let cancelled = false;
    setTokenLoading(true);
    void agentApi.notifications
      .getPushTokenStatus()
      .then((result) => {
        if (cancelled) return;
        setHasRegisteredPushTokens(result.hasRegisteredTokens === true);
      })
      .catch(() => {
        if (!cancelled) setHasRegisteredPushTokens(null);
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, permission.isGranted]);

  return useMemo(() => {
    const canAcceptOrders = verification.status?.can_accept_orders === true;
    const whatsappReady =
      preferences.prefs?.whatsappEnabled === true &&
      preferences.prefs?.phoneNumberVerified === true &&
      !!preferences.prefs?.phoneNumber;
    const hasPush = permission.isGranted && hasRegisteredPushTokens === true;
    return {
      canAcceptOrders,
      hasPush,
      whatsappReady,
      pushDenied: permission.isDenied,
      pushMissingToken: permission.isGranted && hasRegisteredPushTokens === false,
      needsAttention: canAcceptOrders && (!hasPush || !whatsappReady),
      loading:
        enabled &&
        (verification.loading ||
          permission.isLoading ||
          preferences.loading ||
          tokenLoading),
    };
  }, [
    enabled,
    hasRegisteredPushTokens,
    permission.isDenied,
    permission.isGranted,
    permission.isLoading,
    preferences.loading,
    preferences.prefs,
    tokenLoading,
    verification.loading,
    verification.status,
  ]);
}
