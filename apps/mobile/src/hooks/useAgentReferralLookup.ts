import { useEffect, useState } from 'react';
import { publicApiGet } from '@/services/publicApiClient';

export interface AgentReferralLookupResult {
  agentCode: string;
  fullName: string;
  firstName?: string;
  kind?: 'user' | 'agent' | 'business';
}

interface UseAgentReferralLookupState {
  result: AgentReferralLookupResult | null;
  loading: boolean;
  error: string | null;
}

type LookupOutcome<T> =
  | { status: 'hit'; data: T }
  | { status: 'miss' }
  | { status: 'error'; message: string };

function isNotFoundMessage(message: string): boolean {
  return /not found/i.test(message) || message === 'Not Found';
}

async function lookupPublic<T extends { success: boolean }>(
  endpoint: string
): Promise<LookupOutcome<T>> {
  try {
    const response = await publicApiGet<T>(endpoint);
    if (response.success) {
      return { status: 'hit', data: response };
    }
    return { status: 'miss' };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Referral lookup failed';
    if (isNotFoundMessage(message)) {
      return { status: 'miss' };
    }
    return { status: 'error', message };
  }
}

export function useAgentReferralLookup(
  code: string,
  debounceMs = 400
): UseAgentReferralLookupState {
  const [result, setResult] = useState<AgentReferralLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedCode, setTrackedCode] = useState(code);

  if (code !== trackedCode) {
    setTrackedCode(code);
    const next = code.trim();
    if (!next || next.length !== 6) {
      setResult(null);
      setError(null);
      setLoading(false);
    } else {
      setResult(null);
      setError(null);
      setLoading(true);
    }
  }

  useEffect(() => {
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
    setLoading(true);
    const timer = setTimeout(async () => {
      setError(null);
      setResult(null);

      try {
        const userLookup = await lookupPublic<{
          success: boolean;
          referralCode: string;
          fullName: string;
          firstName?: string;
          kind?: 'user' | 'agent' | 'business';
        }>(`/users/public/by-referral-code/${trimmed}`);

        if (cancelled) return;

        if (userLookup.status === 'hit') {
          setResult({
            agentCode: userLookup.data.referralCode,
            fullName: userLookup.data.fullName,
            firstName: userLookup.data.firstName,
            kind: userLookup.data.kind ?? 'user',
          });
          return;
        }

        if (userLookup.status === 'error') {
          setError(userLookup.message);
          return;
        }

        setError('No referrer found for this code');
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'No referrer found for this code';
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
  }, [code, debounceMs]);

  return { result, loading, error };
}
