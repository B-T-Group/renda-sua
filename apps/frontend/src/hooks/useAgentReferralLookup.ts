import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AgentReferralLookupResult {
  agentCode: string;
  fullName: string;
}

interface UseAgentReferralLookupState {
  result: AgentReferralLookupResult | null;
  loading: boolean;
  error: string | null;
}

export const useAgentReferralLookup = (
  code: string,
  debounceMs: number = 400
): UseAgentReferralLookupState => {
  const apiClient = useApiClient();
  const [result, setResult] = useState<AgentReferralLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiClient) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (trimmed.length !== 6) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await apiClient.get<{
          success: boolean;
          agentCode: string;
          fullName: string;
        }>(`/agents/public/by-code/${trimmed}`);

        if (cancelled) return;

        if (response.data.success) {
          setResult({
            agentCode: response.data.agentCode,
            fullName: response.data.fullName,
          });
        } else {
          setError('No agent found for this code');
        }
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err?.response?.data?.error ||
          err?.message ||
          'No agent found for this code';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiClient, code, debounceMs]);

  return { result, loading, error };
};

