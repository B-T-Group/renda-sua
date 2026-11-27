import { useCallback, useEffect, useState } from 'react';
import { rentalsApi } from '../services/rentalsApi';
import type { BusinessReturnConfirmationRow } from '../types/rentals';
import { pendingReturnConfirmations } from '../utils/rentals/dashboardReturnConfirmations';

export function useBusinessReturnConfirmations(enabled: boolean) {
  const [rows, setRows] = useState<BusinessReturnConfirmationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    let cancelled = false;
    rentalsApi
      .getReturnConfirmations()
      .then((data) => {
        if (!cancelled) setRows(pendingReturnConfirmations(data, true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /** Settles a legacy booking at the renter's reported time; rejects with the API error. */
  const confirm = useCallback(async (row: BusinessReturnConfirmationRow) => {
    setBusyId(row.id);
    try {
      const res = await rentalsApi.confirmReturn(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      return Boolean(res.paymentPending || res.overtimeDue);
    } finally {
      setBusyId(null);
    }
  }, []);

  return { rows, busyId, confirm };
}
