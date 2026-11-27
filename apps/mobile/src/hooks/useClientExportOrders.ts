import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMyExportOrders, type ExportOrderSummary } from '../services/exportOrdersApi';

export function useClientExportOrders() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ExportOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyExportOrders();
      setRows(data?.items ?? []);
    } catch {
      setError(t('exportOrders.loadError', 'Could not load export orders'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, load };
}
