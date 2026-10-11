import { useCallback, useState } from 'react';
import { setItemAlert } from '../services/restockAlertsApi';

export type RestockToastState =
  | { kind: 'on' }
  | { kind: 'off'; itemId: string }
  | { kind: 'error' }
  | null;

/**
 * Bell toggle shared by Likes and the item screen. PUT /restock-alerts/items/:id,
 * then a toast: "Alert on", or "Alert off · Undo" (undo = PUT the opposite).
 * No confirmation modal.
 */
export function useRestockBellToggle(onApplied: (itemId: string, enabled: boolean) => void) {
  const [toast, setToast] = useState<RestockToastState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = useCallback(
    async (itemId: string, enabled: boolean): Promise<boolean> => {
      setPendingId(itemId);
      try {
        await setItemAlert(itemId, enabled);
        onApplied(itemId, enabled);
        setToast(enabled ? { kind: 'on' } : { kind: 'off', itemId });
        return true;
      } catch {
        setToast({ kind: 'error' });
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [onApplied]
  );

  const undo = useCallback(() => {
    if (toast?.kind === 'off') void toggle(toast.itemId, true);
  }, [toast, toggle]);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, pendingId, toggle, undo, dismissToast };
}
