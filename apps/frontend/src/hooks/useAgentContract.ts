import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AgentContractLanguageNeeds {
  needsNationality: boolean;
  needsIdNumber: boolean;
}

export interface AgentContractStatus {
  required: boolean;
  signed: boolean;
  status: string | null;
  templateKey: string | null;
  language?: 'en' | 'fr';
  byLanguage?: Record<'en' | 'fr', AgentContractLanguageNeeds>;
  needsNationality: boolean;
  needsIdNumber: boolean;
  missingPhone: boolean;
  missingEmail: boolean;
  signerEmail: string | null;
}

interface StatusResponse {
  success: boolean;
  data: AgentContractStatus;
}

export function useAgentContract(enabled = true) {
  const api = useApiClient();
  const [status, setStatus] = useState<AgentContractStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<StatusResponse>('/agent-contracts/status');
      setStatus(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load agreement');
    } finally {
      setLoading(false);
    }
  }, [api, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (
      path: 'ensure' | 'resend' | 'refresh',
      body?: { language?: 'en' | 'fr'; nationality?: string; idNumber?: string }
    ): Promise<AgentContractStatus | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<StatusResponse>(`/agent-contracts/${path}`, body ?? {});
        setStatus(res.data.data);
        return res.data.data;
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to update agreement');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  return { status, loading, error, reload: load, submit };
}
