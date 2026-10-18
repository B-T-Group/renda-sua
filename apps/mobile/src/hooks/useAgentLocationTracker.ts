/**
 * Agent location: foreground interval or OS background updates (TaskManager).
 * Consent-driven via agents location_tracking_consent_ios / _android (server).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { useStore } from '../stores/RootStore';
import { updateMyAgentLocation } from '../services/agentLocationHasura';
import { haversineDistanceM } from '../utils/haversineDistanceM';
import {
  readLastSentLocation,
  writeLastSentLocation,
  clearLastSentLocation,
  getStopGeneration,
  beginSend,
  endSend,
  recordFailure,
  clearFailure,
  canRetryAfterFailure,
} from '../utils/agentLocationLastSentStorage';
import { shouldSendLocation } from '../utils/shouldSendLocation';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_SLACK_MS } from '../constants/agentLocationBackground';
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from './agentLocationBackgroundSync';
import { runAgentLocationPermissionFlow } from '../utils/agentLocationPermissionFlow';
import { useAgentLocationPermissionSync } from './useAgentLocationPermissionSync';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';

const DEFAULT_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const MIN_DISTANCE_CHANGE_M = 100;
const FAILURE_BACKOFF_MS = 60 * 1000;

type TrackerOptions = {
  consent: AgentLocationTrackingConsent;
  consentLoading: boolean;
  setConsent: (c: AgentLocationTrackingConsent) => Promise<void>;
  consentEnabled: boolean;
  updateIntervalMs?: number;
  minDistanceChangeM?: number;
};

export function useAgentLocationTracker(options: TrackerOptions) {
  const {
    consent,
    consentLoading,
    setConsent,
    consentEnabled,
    updateIntervalMs = DEFAULT_UPDATE_INTERVAL_MS,
    minDistanceChangeM = MIN_DISTANCE_CHANGE_M,
  } = options;

  const { auth, persona } = useStore();
  const shouldTrack =
    consentEnabled &&
    auth.isAuthenticated &&
    !!auth.user?.id &&
    persona.showMainApp &&
    !persona.isDelegationContext &&
    persona.activePersona === 'agent';

  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const [locationSetupReady, setLocationSetupReady] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'background' | 'foreground' | 'off'>('off');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUpdatingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundUpdatesActiveRef = useRef(false);
  const disclosureWaiterRef = useRef<((result: 'completed' | 'declined') => void) | null>(null);
  const [disclosurePermissionLoading, setDisclosurePermissionLoading] = useState(false);

  const resolveDisclosureWaiter = useCallback((result: 'completed' | 'declined') => {
    const resolve = disclosureWaiterRef.current;
    disclosureWaiterRef.current = null;
    resolve?.(result);
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(async () => {
    stopInterval();
    await stopBackgroundLocationUpdates();
    backgroundUpdatesActiveRef.current = false;
    await clearLastSentLocation();
    setLocationSetupReady(false);
    setDisclosureVisible(false);
    setTrackingMode('off');
  }, [stopInterval]);

  const updateLocation = useCallback(async () => {
    if (!shouldTrack || !locationSetupReady) return;
    if (!auth.user?.id) return;
    if (isUpdatingRef.current) return;

    if (!beginSend()) return;

    try {
      isUpdatingRef.current = true;
      setError(null);

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return;

      const generation = getStopGeneration();
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      const prev = await readLastSentLocation(auth.user.id);
      const nowMs = Date.now();

      const shouldSend = shouldSendLocation(
        prev,
        latitude,
        longitude,
        nowMs,
        minDistanceChangeM,
        HEARTBEAT_INTERVAL_MS,
        HEARTBEAT_SLACK_MS,
        haversineDistanceM
      );

      if (!shouldSend) return;

      if (!canRetryAfterFailure(FAILURE_BACKOFF_MS)) return;

      let res;
      try {
        res = await updateMyAgentLocation(latitude, longitude);
      } catch (e: unknown) {
        recordFailure();
        setError(e instanceof Error ? e.message : 'Network error');
        return;
      }

      if (!res.success) {
        recordFailure();
        setError(res.error ?? 'Failed to send location');
        return;
      }
      clearFailure();
      await writeLastSentLocation(latitude, longitude, nowMs, auth.user.id, generation);
      setLastUpdate(nowMs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Location error');
    } finally {
      isUpdatingRef.current = false;
      endSend();
    }
  }, [auth.user?.id, locationSetupReady, minDistanceChangeM, shouldTrack]);

  const startInterval = useCallback(() => {
    stopInterval();
    void updateLocation();
    intervalRef.current = setInterval(() => void updateLocation(), updateIntervalMs);
  }, [stopInterval, updateIntervalMs, updateLocation]);

  const activeDelivery = updateIntervalMs < DEFAULT_UPDATE_INTERVAL_MS;

  const tryStartBackgroundUpdates = useCallback(async (): Promise<boolean> => {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== Location.PermissionStatus.GRANTED) return false;
    try {
      await startBackgroundLocationUpdates(
        i18n.t('agent.locationTracking.notificationTitle', 'Delivery tracking'),
        i18n.t(
          'agent.locationTracking.notificationBody',
          'Updating your position for customers on active deliveries.'
        ),
        { activeDelivery }
      );
      backgroundUpdatesActiveRef.current = true;
      stopInterval();
      setTrackingMode('background');
      return true;
    } catch {
      backgroundUpdatesActiveRef.current = false;
      return false;
    }
  }, [activeDelivery, stopInterval]);

  const startForegroundOnlyTracking = useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      setLocationSetupReady(false);
      setTrackingMode('off');
      return;
    }
    backgroundUpdatesActiveRef.current = false;
    startInterval();
    setLocationSetupReady(true);
    setTrackingMode('foreground');
  }, [startInterval]);

  const reconcileTrackingForConsent = useCallback(
    async (c: AgentLocationTrackingConsent) => {
      if (!shouldTrack) {
        await stopTracking();
        return;
      }

      if (c !== 'accepted') {
        await stopTracking();
        return;
      }

      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== Location.PermissionStatus.GRANTED) {
        await stopTracking();
        return;
      }

      const started = await tryStartBackgroundUpdates();
      if (!started) {
        await startForegroundOnlyTracking();
      } else {
        setLocationSetupReady(true);
      }
    },
    [shouldTrack, startForegroundOnlyTracking, stopTracking, tryStartBackgroundUpdates]
  );

  useAgentLocationPermissionSync({
    enabled: shouldTrack,
    consent,
    consentLoading,
    onReconcileTracking: reconcileTrackingForConsent,
  });

  useEffect(() => {
    if (!shouldTrack) {
      void stopTracking();
      return undefined;
    }
    return () => {
      void stopTracking();
    };
  }, [shouldTrack, stopTracking]);

  useEffect(() => {
    if (!shouldTrack || consentLoading) return;

    void (async () => {
      if (consent === 'not_shown') {
        setDisclosureVisible(true);
        return;
      }

      setDisclosureVisible(false);
      await reconcileTrackingForConsent(consent);
    })();
  }, [consent, consentLoading, reconcileTrackingForConsent, shouldTrack]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'background' &&
        nextState === 'active' &&
        !backgroundUpdatesActiveRef.current &&
        locationSetupReady
      ) {
        void updateLocation();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [locationSetupReady, updateLocation]);

  useEffect(() => {
    if (!locationSetupReady || trackingMode !== 'foreground') return;
    startInterval();
  }, [locationSetupReady, startInterval, trackingMode, updateIntervalMs]);

  useEffect(() => {
    if (!locationSetupReady || trackingMode !== 'background') return;
    void (async () => {
      const ok = await tryStartBackgroundUpdates();
      if (!ok) await startForegroundOnlyTracking();
    })();
  }, [
    activeDelivery,
    locationSetupReady,
    startForegroundOnlyTracking,
    trackingMode,
    tryStartBackgroundUpdates,
  ]);

  const onDisclosureContinue = useCallback(() => {
    setDisclosurePermissionLoading(true);
    void (async () => {
      try {
        await setConsent('accepted');
        await runAgentLocationPermissionFlow();
        await reconcileTrackingForConsent('accepted');
        setDisclosureVisible(false);
        resolveDisclosureWaiter('completed');
      } catch {
        setDisclosureVisible(false);
        resolveDisclosureWaiter('declined');
      } finally {
        setDisclosurePermissionLoading(false);
      }
    })();
  }, [reconcileTrackingForConsent, resolveDisclosureWaiter, setConsent]);

  const promptPermissionsWithDisclosure = useCallback((): Promise<'completed' | 'declined'> => {
    return new Promise((resolve) => {
      disclosureWaiterRef.current = resolve;
      setDisclosureVisible(true);
    });
  }, []);

  const runPermissionFlow = useCallback(async () => {
    await setConsent('accepted');
    await runAgentLocationPermissionFlow();
    await reconcileTrackingForConsent('accepted');
    return 'accepted' as const;
  }, [reconcileTrackingForConsent, setConsent]);

  const isTrackingActive =
    trackingMode !== 'off' && locationSetupReady && consent === 'accepted';

  return {
    error,
    lastUpdate,
    updateLocation,
    stopTracking,
    disclosureVisible,
    disclosurePermissionLoading,
    onDisclosureContinue,
    promptPermissionsWithDisclosure,
    runPermissionFlow,
    consent,
    isTrackingActive,
    trackingMode,
    locationSetupReady,
  };
}
