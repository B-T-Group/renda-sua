import { useCallback, useEffect, useState } from 'react';
import { findLikedRestockItem } from '../services/restockAlertsApi';

/**
 * Bell state for the item screen. There is no single-item read route, so we
 * look the item up in the user's likes (GET /restock-alerts/likes). A liked,
 * sold-out item is armed by default (AC §1), so "not found / error" = on.
 */
export function useRestockItemAlert(params: {
  active: boolean;
  catalogItemId: string | undefined;
}) {
  const { active, catalogItemId } = params;
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active || !catalogItemId) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void findLikedRestockItem(catalogItemId)
      .then((hit) => {
        if (cancelled) return;
        if (hit?.restock_alert?.state != null) setEnabled(hit.restock_alert.state === 'on');
        else setEnabled(true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, catalogItemId]);

  const applied = useCallback((_id: string, next: boolean) => setEnabled(next), []);

  return { enabled, loaded, applied };
}
