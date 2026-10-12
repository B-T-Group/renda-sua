import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUserProfileContext } from './UserProfileContext';
import {
  useAgentContract,
  type AgentContractStatus,
} from '../hooks/useAgentContract';

type AgentContractValue = ReturnType<typeof useAgentContract> & {
  lockReleased: boolean;
  releaseLock: () => void;
};

const AgentContractContext = createContext<AgentContractValue | null>(null);

export function AgentContractProvider({ children }: { children: React.ReactNode }) {
  const { userType } = useUserProfileContext();
  const contract = useAgentContract(userType === 'agent');
  const [lockReleased, setLockReleased] = useState(false);
  const releaseLock = useCallback(() => setLockReleased(true), []);
  useEffect(() => {
    if (contract.status?.signed === false) setLockReleased(false);
  }, [contract.status?.signed]);
  const value = useMemo(
    () => ({ ...contract, lockReleased, releaseLock }),
    [contract, lockReleased, releaseLock]
  );
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
  loading: boolean,
  lockReleased = false
): boolean {
  if (userType !== 'agent') return false;
  if (lockReleased) return false;
  if (loading && !status) return true;
  if (!status) return true;
  return status.required && !status.signed;
}
