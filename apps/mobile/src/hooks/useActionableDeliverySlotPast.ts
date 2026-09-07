import { useEffect, useState } from 'react';
import type { IncomingOrderDetails } from '../types/incomingOrder';
import {
  deliverySlotEnd,
  isActionableDeliverySlotPast,
} from '../utils/isDeliverySlotPast';

/** Re-evaluates past-slot once the scheduled window actually ends. */
export function useActionableDeliverySlotPast(
  details: IncomingOrderDetails | null | undefined,
  uiState: string
): boolean {
  const [now, setNow] = useState(() => new Date());
  const endMs = deliverySlotEnd(details)?.getTime() ?? null;

  useEffect(() => {
    if (endMs == null) return;
    const remaining = endMs - Date.now();
    if (remaining <= 0) return;
    const id = setTimeout(() => setNow(new Date()), remaining + 1);
    return () => clearTimeout(id);
  }, [endMs]);

  const clock =
    endMs != null && Date.now() > endMs ? new Date() : now;
  return isActionableDeliverySlotPast(details, uiState, clock);
}
