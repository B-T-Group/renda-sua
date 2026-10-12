import React, { createContext, useContext } from 'react';
import { useUserProfileContext } from './UserProfileContext';
import {
  useAgentContract,
  type AgentContractStatus,
} from '../hooks/useAgentContract';

type AgentContractValue = ReturnType<typeof useAgentContract>;

const AgentContractContext = createContext<AgentContractValue | null>(null);

export function AgentContractProvider({ children }: { children: React.ReactNode }) {
  const { userType } = useUserProfileContext();
  const value = useAgentContract(userType === 'agent');
  return (
    <AgentContractContext.Provider value={value}>{children}</AgentContractContext.Provider>
  );
}

export function useAgentContractContext(): AgentContractValue {
  const value = useContext(AgentContractContext);
  if (!value) {
    throw new Error('Agent contract context is missing');
  }
  return value;
}

export function agentAppLocked(
  userType: string | null | undefined,
  status: AgentContractStatus | null,
  loading: boolean
): boolean {
  if (userType !== 'agent') return false;
  if (loading && !status) return true;
  if (!status) return true;
  return status.required && !status.signed;
}
