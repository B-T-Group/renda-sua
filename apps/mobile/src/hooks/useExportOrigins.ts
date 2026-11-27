import { useCallback, useEffect, useState } from 'react';
import { fetchExportOrigins, type ExportOriginSummary } from '../services/inventoryItemsApi';

/** Countries with ≥1 live export item, with counts (for the Exports lane origin picker). */
export function useExportOrigins(enabled = true) {
  const [origins, setOrigins] = useState<ExportOriginSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetchExportOrigins({ signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setOrigins(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { origins, loading, error, refetch };
}
