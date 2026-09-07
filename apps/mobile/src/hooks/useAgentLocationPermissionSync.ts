import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';
import { readOsLocationPermissions, osPermGranted } from '../utils/agentLocationPermissionFlow';

type SyncDeps = {
  enabled: boolean;
  consent: AgentLocationTrackingConsent;
  consentLoading: boolean;
  onReconcileTracking: (consent: AgentLocationTrackingConsent) => Promise<void>;
  onOsPermissionChange?: (foregroundGranted: boolean) => void;
};

export function useAgentLocationPermissionSync({
  enabled,
  consent,
  consentLoading,
  onReconcileTracking,
  onOsPermissionChange,
}: SyncDeps) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFromOs = useCallback(async () => {
    if (!enabled || consentLoading || syncingRef.current) {
      return;
    }

    syncingRef.current = true;
    try {
      const snap = await readOsLocationPermissions();
      const fgGranted = osPermGranted(snap.foreground);
      onOsPermissionChange?.(fgGranted);
      await onReconcileTracking(consent);
    } finally {
      syncingRef.current = false;
    }
  }, [consent, consentLoading, enabled, onOsPermissionChange, onReconcileTracking]);

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void syncFromOs();
    }, 300);
  }, [syncFromOs]);

  useEffect(() => {
    if (!enabled || consentLoading) return undefined;

    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        scheduleSync();
      }
      appStateRef.current = next;
    });

    return () => {
      sub.remove();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [consentLoading, enabled, scheduleSync]);

  return { syncFromOs, scheduleSync };
}
