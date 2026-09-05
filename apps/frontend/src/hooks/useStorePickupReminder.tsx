import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useOrderById, type OrderData } from './useOrderById';

type SheetState = {
  orderId: string;
  orderNumber?: string | null;
};

type StorePickupReminderContextValue = {
  visible: boolean;
  order: OrderData | null;
  orderId: string | null;
  orderNumber: string | null;
  loading: boolean;
  showCancel: boolean;
  open: (orderId: string, orderNumber?: string | null) => void;
  dismiss: () => void;
  openCancel: () => void;
  closeCancel: () => void;
  onCancelSuccess: () => void;
  messageBusiness: () => void;
};

const StorePickupReminderContext =
  createContext<StorePickupReminderContextValue | null>(null);

export function StorePickupReminderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userType } = useUserProfileContext();
  const { order: fetchedOrder, fetchOrder, loading: orderLoading } =
    useOrderById();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const isClient = userType === 'client';
  const order =
    sheet && fetchedOrder?.id === sheet.orderId ? fetchedOrder : null;

  const dismiss = useCallback(() => {
    setSheet(null);
    setShowCancel(false);
    if (location.search.includes('pickupReminder=1')) {
      const params = new URLSearchParams(location.search);
      params.delete('pickupReminder');
      const next = params.toString();
      navigate(
        { pathname: location.pathname, search: next ? `?${next}` : '' },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, navigate]);

  const open = useCallback(
    (orderId: string, orderNumber?: string | null) => {
      if (!isClient || !orderId) return;
      setSheet({ orderId, orderNumber });
      setShowCancel(false);
    },
    [isClient]
  );

  useEffect(() => {
    if (!isClient || !sheet?.orderId) return;
    void fetchOrder(sheet.orderId);
  }, [fetchOrder, isClient, sheet?.orderId]);

  useEffect(() => {
    if (!isClient) return;
    const match = location.pathname.match(/^\/orders\/([0-9a-f-]{36})/i);
    const params = new URLSearchParams(location.search);
    if (match?.[1] && params.get('pickupReminder') === '1') {
      open(match[1]);
    }
  }, [isClient, location.pathname, location.search, open]);

  useEffect(() => {
    if (!isClient || !('serviceWorker' in navigator)) return undefined;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data ?? {};
      if (data.type !== 'store-pickup-reminder') return;
      const orderId =
        typeof data.orderId === 'string' ? data.orderId : null;
      if (!orderId) return;
      open(
        orderId,
        typeof data.orderNumber === 'string' ? data.orderNumber : null
      );
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isClient, open]);

  const messageBusiness = useCallback(() => {
    if (!sheet?.orderId) return;
    const draft = t(
      'orders.storePickupReminder.draftMessage',
      'Hi! Just confirming I’m still coming to pick up order {{orderNumber}}. See you soon.',
      { orderNumber: sheet.orderNumber || order?.order_number || '' }
    );
    const params = new URLSearchParams({ draft });
    dismiss();
    navigate(`/orders/${sheet.orderId}/messages?${params.toString()}`);
  }, [dismiss, navigate, order?.order_number, sheet, t]);

  const value = useMemo<StorePickupReminderContextValue>(
    () => ({
      visible: !!sheet,
      order,
      orderId: sheet?.orderId ?? null,
      orderNumber: sheet?.orderNumber ?? order?.order_number ?? null,
      loading: !!sheet && orderLoading,
      showCancel,
      open,
      dismiss,
      openCancel: () => setShowCancel(true),
      closeCancel: () => setShowCancel(false),
      onCancelSuccess: () => dismiss(),
      messageBusiness,
    }),
    [
      dismiss,
      messageBusiness,
      open,
      order,
      orderLoading,
      sheet,
      showCancel,
    ]
  );

  return (
    <StorePickupReminderContext.Provider value={value}>
      {children}
    </StorePickupReminderContext.Provider>
  );
}

export function useStorePickupReminder() {
  const value = useContext(StorePickupReminderContext);
  if (!value) {
    throw new Error(
      'useStorePickupReminder must be used inside StorePickupReminderProvider'
    );
  }
  return value;
}
