import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AgentReferralLookupResult {
  agentCode: string;
  fullName: string;
  firstName?: string;
  kind?: 'agent' | 'business';
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

    setResult(null);
    setError(null);
    setLoading(true);

    let cancelled = false;
    const timer = setTimeout(async () => {
      setError(null);
      setResult(null);

      try {
        const userRes = await apiClient
          .get<{
            success: boolean;
            referralCode: string;
            fullName: string;
            firstName?: string;
            kind?: 'user' | 'agent' | 'business';
          }>(`/users/public/by-referral-code/${trimmed}`)
          .then((res) => ({ ok: true as const, data: res.data }))
          .catch(() => ({ ok: false as const, data: null }));

        if (cancelled) return;

        if (userRes.ok && userRes.data?.success) {
          setResult({
            agentCode: userRes.data.referralCode,
            fullName: userRes.data.fullName,
            firstName: userRes.data.firstName,
            kind: userRes.data.kind === 'business' ? 'business' : 'agent',
          });
          return;
        }

        const [agentOutcome, businessOutcome] = await Promise.all([
          apiClient
            .get<{
              success: boolean;
              agentCode: string;
              fullName: string;
              firstName?: string;
            }>(`/agents/public/by-code/${trimmed}`)
            .then((res) => ({ ok: true as const, data: res.data }))
            .catch(() => ({ ok: false as const, data: null })),
          apiClient
            .get<{
              success: boolean;
              businessCode: string;
              businessName: string;
            }>(`/businesses/public/by-code/${trimmed}`)
            .then((res) => ({ ok: true as const, data: res.data }))
            .catch(() => ({ ok: false as const, data: null })),
        ]);

        if (cancelled) return;

        const agentHit = agentOutcome.ok && agentOutcome.data?.success;
        const businessHit =
          businessOutcome.ok && businessOutcome.data?.success;

        // Match backend: reject legacy agent+business code collisions.
        if (agentHit && businessHit) {
          setError('This referral code is not currently active');
          return;
        }

        if (agentHit && agentOutcome.data) {
          setResult({
            agentCode: agentOutcome.data.agentCode,
            fullName: agentOutcome.data.fullName,
            firstName: agentOutcome.data.firstName,
            kind: 'agent',
          });
          return;
        }

        if (businessHit && businessOutcome.data) {
          setResult({
            agentCode: businessOutcome.data.businessCode,
            fullName: businessOutcome.data.businessName,
            firstName: businessOutcome.data.businessName,
            kind: 'business',
          });
          return;
        }

        setError('No referrer found for this code');
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err?.response?.data?.error ||
          err?.message ||
          'No referrer found for this code';
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
