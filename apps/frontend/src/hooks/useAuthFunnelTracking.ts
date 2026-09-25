import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { useClientFlags } from './useClientFlags';
import {
  SITE_EVENT_AUTH_GATE_DISMISSED,
  SITE_EVENT_AUTH_GATE_SHOWN,
  SITE_EVENT_AUTH_LOCKED,
  SITE_EVENT_AUTH_PASSWORD_USED,
  useTrackSiteEvent,
} from './useTrackSiteEvent';
import {
  stashAuthGatePending,
  type AuthGatePending,
} from '../utils/authFunnelTracking';

export function useAuthFunnelTracking(context: string) {
  const { trackSiteEvent } = useTrackSiteEvent();
  const { flags } = useClientFlags();
  const flagOn = flags.auth_web_inapp_gates ?? false;

  const baseMetadata = useCallback(
    (entry: string, authPath: string) => ({
      entry,
      context,
      platform: 'web' as const,
      flag_on: flagOn,
      auth_path: authPath,
    }),
    [context, flagOn]
  );

  const trackAuthGateShown = useCallback(
    (entry: string, authPath = 'auth0_ul') => {
      const shownAt = Date.now();
      const pending: AuthGatePending = {
        entry,
        shownAt,
        context,
        flag_on: flagOn,
        auth_path: authPath,
      };
      stashAuthGatePending(pending);
      void trackSiteEvent({
        eventType: SITE_EVENT_AUTH_GATE_SHOWN,
        metadata: baseMetadata(entry, authPath),
      });
    },
    [baseMetadata, context, flagOn, trackSiteEvent]
  );

  const trackAuthGateDismissed = useCallback(
    (
      entry: string,
      authPath = 'auth0_ul',
      step?: 'identifier' | 'code' | 'password' | 'locked' | 'finish'
    ) => {
      void trackSiteEvent({
        eventType: SITE_EVENT_AUTH_GATE_DISMISSED,
        metadata: {
          ...baseMetadata(entry, authPath),
          ...(step ? { step } : {}),
        },
      });
    },
    [baseMetadata, trackSiteEvent]
  );

  const trackAuthLocked = useCallback(
    (entry: string, authPath = 'inapp') => {
      void trackSiteEvent({
        eventType: SITE_EVENT_AUTH_LOCKED,
        metadata: baseMetadata(entry, authPath),
      });
    },
    [baseMetadata, trackSiteEvent]
  );

  const trackAuthPasswordUsed = useCallback(
    (entry: string, authPath = 'inapp') => {
      void trackSiteEvent({
        eventType: SITE_EVENT_AUTH_PASSWORD_USED,
        metadata: baseMetadata(entry, authPath),
      });
    },
    [baseMetadata, trackSiteEvent]
  );

  const { loginWithRedirect } = useAuth0();

  const loginWithRedirectTracked = useCallback(
    async (
      entry: string,
      options?: Parameters<typeof loginWithRedirect>[0]
    ) => {
      trackAuthGateShown(entry);
      await loginWithRedirect(options);
    },
    [loginWithRedirect, trackAuthGateShown]
  );

  return {
    flagOn,
    trackAuthGateShown,
    trackAuthGateDismissed,
    trackAuthLocked,
    trackAuthPasswordUsed,
    loginWithRedirectTracked,
  };
}
