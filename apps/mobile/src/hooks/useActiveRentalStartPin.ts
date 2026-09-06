import { useCallback, useEffect, useState } from 'react';
import { rentalsApi } from '../services/rentalsApi';

export function useActiveRentalStartPin(
  bookingId: string | null | undefined,
  visible: boolean
) {
  const [autoSharedPin, setAutoSharedPin] = useState<string | null>(null);
  const [autoPinMessageId, setAutoPinMessageId] = useState<string | null>(null);
  const [resolvingSharedPin, setResolvingSharedPin] = useState(false);
  const [noSharedPin, setNoSharedPin] = useState(false);

  const resetSharedPinState = useCallback(() => {
    setAutoSharedPin(null);
    setAutoPinMessageId(null);
    setNoSharedPin(false);
  }, []);

  useEffect(() => {
    if (!visible || !bookingId) return;
    let cancelled = false;
    setResolvingSharedPin(true);
    setAutoSharedPin(null);
    setAutoPinMessageId(null);
    setNoSharedPin(false);
    void rentalsApi
      .getActiveStartPin(bookingId)
      .then((active) => {
        if (cancelled) return;
        if (active?.pin) {
          setAutoSharedPin(active.pin);
          setAutoPinMessageId(active.messageId);
        } else {
          setNoSharedPin(true);
        }
      })
      .finally(() => {
        if (!cancelled) setResolvingSharedPin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, bookingId]);

  return {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  };
}
