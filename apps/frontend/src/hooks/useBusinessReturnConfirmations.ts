import { useCallback, useEffect, useState } from 'react';
import type { BusinessReturnConfirmationRow } from './useRentalApi';
import { useRentalApi } from './useRentalApi';
import { pendingReturnConfirmations } from '../utils/dashboardReturnConfirmations';

export function useBusinessReturnConfirmations(enabled: boolean) {
  const { fetchBusinessReturnConfirmations, confirmReturn } = useRentalApi();
  const [rows, setRows] = useState<BusinessReturnConfirmationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    let cancelled = false;
    fetchBusinessReturnConfirmations()
      .then((data) => {
        if (!cancelled) setRows(pendingReturnConfirmations(data, true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchBusinessReturnConfirmations]);

  /** Settles a legacy booking at the renter's reported time; rejects with the API error. */
  const confirm = useCallback(
    async (row: BusinessReturnConfirmationRow) => {
      setBusyId(row.id);
      try {
        const res = await confirmReturn(row.id);
        setRows((current) => current.filter((item) => item.id !== row.id));
        return Boolean(res.paymentPending || res.overtimeDue);
      } finally {
        setBusyId(null);
      }
    },
    [confirmReturn]
  );

  return { rows, busyId, confirm };
}
