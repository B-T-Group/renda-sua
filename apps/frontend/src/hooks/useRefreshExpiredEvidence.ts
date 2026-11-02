import { useEffect } from 'react';
import {
  nextEvidenceRefreshDelayMs,
  shouldRefreshAppealEvidence,
} from '../utils/itemRejectionRecovery';

export function useRefreshExpiredEvidence(
  evidence: Array<{ expiresAt?: string | null }> | null | undefined,
  refresh: () => unknown
) {
  const stamp = JSON.stringify((evidence ?? []).map((item) => item.expiresAt ?? null));
  useEffect(() => {
    const expires = JSON.parse(stamp) as Array<string | null>;
    if (!expires.length) return undefined;
    const items = expires.map((expiresAt) => ({ expiresAt }));
    if (shouldRefreshAppealEvidence(items)) {
      void refresh();
      return undefined;
    }
    const delay = nextEvidenceRefreshDelayMs(items);
    if (delay == null) return undefined;
    const id = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(id);
  }, [refresh, stamp]);
}
