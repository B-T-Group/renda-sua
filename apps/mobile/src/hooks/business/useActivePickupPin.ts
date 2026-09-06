import { useCallback, useEffect, useState } from 'react';
import { useOrdersApi } from '../../contexts/OrdersApiContext';

export function useActivePickupPin(
  orderId: string | null | undefined,
  visible: boolean
) {
  const ordersApi = useOrdersApi();
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
    if (!visible || !orderId) return;
    let cancelled = false;
    setResolvingSharedPin(true);
    setAutoSharedPin(null);
    setAutoPinMessageId(null);
    setNoSharedPin(false);
    void ordersApi
      .getActiveDeliveryPin(orderId)
      .then((active) => {
        if (cancelled) return;
        if (active?.pin) {
          setAutoSharedPin(active.pin);
          setAutoPinMessageId(active.messageId);
        } else {
          setNoSharedPin(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (!cancelled) setResolvingSharedPin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, orderId, ordersApi]);

  return {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  };
}
