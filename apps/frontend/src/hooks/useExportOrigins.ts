import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ExportOriginSummary {
  country_code: string;
  item_count: number;
  business_count: number;
  destination_codes: string[];
}

/** Countries with at least one live export item, with counts (public). */
export function useExportOrigins(): {
  origins: ExportOriginSummary[];
  loading: boolean;
  error: boolean;
} {
  const api = useApiClient();
  const [origins, setOrigins] = useState<ExportOriginSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/inventory-items/export-origins')
      .then((res) => {
        if (cancelled) return;
        setOrigins(res.data?.data?.origins ?? []);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return { origins, loading, error };
}
