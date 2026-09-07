import React, { createContext, useContext, type ReactNode } from 'react';
import { useAgentActiveDelivery } from './AgentActiveDeliveryContext';
import { useAgentLocationConsent } from '../hooks/useAgentLocationConsent';
import { useAgentLocationTracker } from '../hooks/useAgentLocationTracker';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';

/** Idle cadence; during active assignment/delivery we poll ~every minute. */
const IDLE_LOCATION_INTERVAL_MS = 20 * 60 * 1000;
const ACTIVE_DELIVERY_INTERVAL_MS = 60 * 1000;
const IDLE_MIN_DISTANCE_M = 100;
const ACTIVE_MIN_DISTANCE_M = 50;

export type AgentLocationContextValue = ReturnType<typeof useAgentLocationConsent> &
  ReturnType<typeof useAgentLocationTracker>;

const AgentLocationContext = createContext<AgentLocationContextValue | null>(null);

export function AgentLocationProvider({ children }: { children: ReactNode }) {
  const consentApi = useAgentLocationConsent();
  const { preferActiveLocationCadence } = useAgentActiveDelivery();
  const tracker = useAgentLocationTracker({
    consent: consentApi.consent,
    consentLoading: consentApi.consentLoading,
    setConsent: consentApi.setConsent,
    consentEnabled: consentApi.enabled,
    updateIntervalMs: preferActiveLocationCadence
      ? ACTIVE_DELIVERY_INTERVAL_MS
      : IDLE_LOCATION_INTERVAL_MS,
    minDistanceChangeM: preferActiveLocationCadence
      ? ACTIVE_MIN_DISTANCE_M
      : IDLE_MIN_DISTANCE_M,
  });

  const value = { ...consentApi, ...tracker };

  return (
    <AgentLocationContext.Provider value={value}>{children}</AgentLocationContext.Provider>
  );
}

export function useAgentLocation(): AgentLocationContextValue {
  const ctx = useContext(AgentLocationContext);
  if (!ctx) {
    throw new Error('useAgentLocation must be used within AgentLocationProvider');
  }
  return ctx;
}

export function useAgentLocationOptional(): AgentLocationContextValue | null {
  return useContext(AgentLocationContext);
}

export type { AgentLocationTrackingConsent };
