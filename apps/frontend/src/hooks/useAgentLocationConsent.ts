import { useCallback, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useUserProfileContext } from '../contexts/UserProfileContext';

export type AgentLocationTrackingConsent = 'not_shown' | 'accepted' | 'deferred';

const CONSENT_VALUES: AgentLocationTrackingConsent[] = [
  'not_shown',
  'accepted',
  'deferred',
];

function isConsent(value: unknown): value is AgentLocationTrackingConsent {
  return typeof value === 'string' && CONSENT_VALUES.includes(value as AgentLocationTrackingConsent);
}

export function useAgentLocationConsent() {
  const apiClient = useApiClient();
  const { profile, userType, refetch } = useUserProfileContext();
  const isAgent = userType === 'agent' && !!profile?.agent;

  const consent = useMemo((): AgentLocationTrackingConsent => {
    const raw = profile?.agent?.location_tracking_consent_web;
    return isConsent(raw) ? raw : 'not_shown';
  }, [profile?.agent?.location_tracking_consent_web]);

  const [saving, setSaving] = useState(false);

  const setConsent = useCallback(
    async (next: AgentLocationTrackingConsent) => {
      setSaving(true);
      try {
        await apiClient.patch('/agents/me/location-tracking-consent', {
          consent: next,
          platform: 'web',
        });
        await refetch();
      } finally {
        setSaving(false);
      }
    },
    [apiClient, refetch]
  );

  const showDisclosure = isAgent && consent === 'not_shown';

  return {
    isAgent,
    consent,
    saving,
    showDisclosure,
    setConsent,
  };
}
