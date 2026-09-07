import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Platform } from 'react-native';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';
import { isAgentLocationTrackingConsent } from '../types/agentLocationConsent';
import {
  getAgentLocationConsentForPlatform,
  getAgentLocationConsentFromResponse,
} from '../utils/agentLocationConsentPlatform';

export function useAgentLocationConsent() {
  const { auth, persona } = useStore();
  const enabled =
    auth.isAuthenticated &&
    !!auth.user?.id &&
    persona.showMainApp &&
    !persona.isDelegationContext &&
    persona.activePersona === 'agent' &&
    Platform.OS !== 'web';

  const [consent, setConsentState] = useState<AgentLocationTrackingConsent>('not_shown');
  const [loading, setLoading] = useState(true);
  const [consentHydrated, setConsentHydrated] = useState(false);

  const applyConsent = useCallback((value: AgentLocationTrackingConsent | undefined) => {
    setConsentState(isAgentLocationTrackingConsent(value) ? value : 'not_shown');
  }, []);

  const fetchConsentFromServer = useCallback(async () => {
    const res = await agentApi.users.getMe();
    applyConsent(getAgentLocationConsentForPlatform(res.user?.agent));
  }, [applyConsent]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    try {
      await fetchConsentFromServer();
    } catch {
      applyConsent('not_shown');
    } finally {
      setLoading(false);
    }
  }, [applyConsent, enabled, fetchConsentFromServer]);

  const consentLoading = enabled ? loading || !consentHydrated : false;

  useLayoutEffect(() => {
    if (enabled) {
      setConsentHydrated(false);
      setLoading(true);
    } else {
      setConsentHydrated(false);
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      applyConsent('not_shown');
      return;
    }
    void (async () => {
      try {
        await fetchConsentFromServer();
      } catch {
        applyConsent('not_shown');
      } finally {
        setConsentHydrated(true);
        setLoading(false);
      }
    })();
  }, [enabled, applyConsent, fetchConsentFromServer]);

  const setConsent = useCallback(
    async (next: AgentLocationTrackingConsent) => {
      const res = await agentApi.agents.updateLocationTrackingConsent(next);
      const fromServer = getAgentLocationConsentFromResponse(res.agent);
      if (fromServer && isAgentLocationTrackingConsent(fromServer)) {
        applyConsent(fromServer);
      } else {
        applyConsent(next);
      }
    },
    [applyConsent]
  );

  return {
    enabled,
    consent,
    loading,
    consentLoading,
    consentHydrated,
    setConsent,
    refetch,
  };
}
