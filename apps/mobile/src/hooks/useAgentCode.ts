import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';

/** Prefers user-level referral_code; falls back to legacy agent_code. */
export function useAgentCode() {
  const [agentCode, setAgentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCode = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentApi.users.getMe();
      const code =
        res?.user?.referral_code?.trim() ||
        res?.user?.agent?.agent_code?.trim() ||
        null;
      setAgentCode(code || null);
    } catch {
      setAgentCode(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  return { agentCode, loading, refetch: fetchCode };
}
