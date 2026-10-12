import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  agentContractApi,
  type AgentContractStatus,
} from '../services/agentContractApi';

export function useAgentContractStatus(): AgentContractStatus | null {
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  useFocusEffect(useCallback(() => loadContractStatus(setStatus), []));
  return status;
}

function loadContractStatus(
  setStatus: (value: AgentContractStatus | null) => void
): () => void {
  let active = true;
  void agentContractApi
    .status()
    .then((res) => {
      if (active) setStatus(res.data);
    })
    .catch(() => {
      if (active) setStatus(null);
    });
  return () => {
    active = false;
  };
}
