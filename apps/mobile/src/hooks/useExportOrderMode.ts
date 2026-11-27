import { useEffect, useState } from 'react';
import { useExportOrders } from './useExportOrders';

/** True when "I'm interested" creates an export order for this market; assumes the lead flow until known. */
export function useExportOrderMode(open: boolean, countryCode?: string): boolean {
  const { getEnabled } = useExportOrders();
  const [orderMode, setOrderMode] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let stop = false;
    setOrderMode(false);
    getEnabled(countryCode)
      .then((enabled) => {
        if (!stop) setOrderMode(enabled);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [open, countryCode, getEnabled]);

  return orderMode;
}
