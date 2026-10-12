import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  agentContractApi,
  type AgentContractStatus,
} from '../services/agentContractApi';
import { agentNeedsContract } from '../utils/agentClaimSetupGate';

export function useAgentContractStatus(): AgentContractStatus | null {
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  useFocusEffect(useCallback(() => loadContractStatus(setStatus), []));
  return status;
}

export function useAgentEntryGate() {
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let active = true;
    void agentContractApi
      .status()
      .then((res) => {
        if (active) setStatus(res.data);
      })
      .catch(() => {
        if (active) setStatus(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const locked = !entered && (loading || !status || agentNeedsContract(status));
  const phase = loading && !status ? 'loading' : locked ? 'locked' : 'open';
  return { phase: phase as 'loading' | 'locked' | 'open', enter: () => setEntered(true) };
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
