import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAgentLocationOptional } from '../contexts/AgentLocationContext';
import { canUseLocationFeatures, isOsForegroundLocationGranted } from '../utils/agentLocationFeatures';

export function useAgentLocationFeatures() {
  const location = useAgentLocationOptional();
  const consent = location?.consent ?? 'not_shown';
  const consentLoading = location?.consentLoading ?? false;
  const [osForegroundGranted, setOsForegroundGranted] = useState(false);
  const [osLoading, setOsLoading] = useState(true);

  const refreshOsPermission = useCallback(async () => {
    if (!location?.enabled) {
      setOsForegroundGranted(false);
      setOsLoading(false);
      return;
    }
    setOsLoading(true);
    try {
      setOsForegroundGranted(await isOsForegroundLocationGranted());
    } finally {
      setOsLoading(false);
    }
  }, [location?.enabled]);

  useEffect(() => {
    void refreshOsPermission();
  }, [refreshOsPermission, consent]);

  useEffect(() => {
    if (!location?.enabled) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshOsPermission();
      }
    });
    return () => sub.remove();
  }, [location?.enabled, refreshOsPermission]);

  const canClaim = canUseLocationFeatures(consent, osForegroundGranted);

  return {
    consent,
    consentLoading,
    osForegroundGranted,
    osLoading,
    canClaim,
    locationRestricted: consent !== 'accepted',
    refreshOsPermission,
    promptPermissionsWithDisclosure: location?.promptPermissionsWithDisclosure,
    runPermissionFlow: location?.runPermissionFlow,
    disclosurePermissionLoading: location?.disclosurePermissionLoading ?? false,
  };
}
