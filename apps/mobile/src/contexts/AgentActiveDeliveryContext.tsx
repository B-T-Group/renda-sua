import React, { createContext, useContext, type ReactNode } from 'react';
import { useAgentActiveDeliveryState } from '../hooks/useAgentActiveDelivery';

type AgentActiveDeliveryValue = ReturnType<typeof useAgentActiveDeliveryState>;

const AgentActiveDeliveryContext = createContext<AgentActiveDeliveryValue | null>(
  null
);

export function AgentActiveDeliveryProvider({ children }: { children: ReactNode }) {
  const value = useAgentActiveDeliveryState();
  return (
    <AgentActiveDeliveryContext.Provider value={value}>
      {children}
    </AgentActiveDeliveryContext.Provider>
  );
}

export function useAgentActiveDelivery(): AgentActiveDeliveryValue {
  const ctx = useContext(AgentActiveDeliveryContext);
  if (!ctx) {
    throw new Error(
      'useAgentActiveDelivery must be used within AgentActiveDeliveryProvider'
    );
  }
  return ctx;
}
