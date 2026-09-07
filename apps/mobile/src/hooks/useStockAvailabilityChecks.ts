import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { requestStockAvailabilityCheck } from '../services/inventoryItemsApi';

type Options = {
  /** When false, calls onLoginRequired instead of the API. */
  isAuthenticated?: boolean;
  onLoginRequired?: () => void;
};

type SnapshotListener = () => void;

const pendingIds = new Set<string>();
/** In-flight request ids shared across hook instances (browse + store detail). */
const sendingIds = new Set<string>();
const snapshotListeners = new Set<SnapshotListener>();

function emitPendingChange(): void {
  snapshotListeners.forEach((listener) => listener());
}

function addPendingId(inventoryId: string): void {
  if (pendingIds.has(inventoryId)) return;
  pendingIds.add(inventoryId);
  emitPendingChange();
}

function removePendingId(inventoryId: string): void {
  if (!pendingIds.delete(inventoryId)) return;
  emitPendingChange();
}

/** Clears pending UI state across all catalog screens (e.g. result push). */
export function clearStockAvailabilityPending(inventoryId: string): void {
  if (!inventoryId) return;
  removePendingId(inventoryId);
}

/** Clears all pending catalog checks (logout / session reset). */
export function resetStockAvailabilityPending(): void {
  if (pendingIds.size === 0 && sendingIds.size === 0) return;
  pendingIds.clear();
  sendingIds.clear();
  emitPendingChange();
}

function parseResultInventoryId(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data || data.type !== 'stock_availability_result') return null;
  const raw = data.inventoryId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

let resultListenerPromise: Promise<void> | null = null;

function ensureResultListener(): Promise<void> {
  if (!resultListenerPromise) {
    resultListenerPromise = (async () => {
      const mod = await loadExpoNotifications();
      if (!mod) {
        resultListenerPromise = null;
        return;
      }
      mod.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const inventoryId = parseResultInventoryId(data);
        if (inventoryId) removePendingId(inventoryId);
      });
    })();
  }
  return resultListenerPromise;
}

/**
 * Per-inventory-id stock availability check state for catalog lists.
 * Pending ids are shared app-wide so browse / store / collection stay in sync.
 */
export function useStockAvailabilityChecks(options: Options = {}) {
  const { t } = useTranslation();
  const { isAuthenticated = true, onLoginRequired } = options;
  const [version, setVersion] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    snapshotListeners.add(onChange);
    void ensureResultListener();
    return () => {
      snapshotListeners.delete(onChange);
    };
  }, []);

  const clearSnack = useCallback(() => setSnack(null), []);

  const isPending = useCallback(
    (inventoryId: string) => pendingIds.has(inventoryId),
    [version]
  );

  const isSending = useCallback(
    (inventoryId: string) => sendingIds.has(inventoryId),
    [version]
  );

  const requestCheck = useCallback(
    async (inventoryId: string) => {
      if (
        !inventoryId ||
        pendingIds.has(inventoryId) ||
        sendingIds.has(inventoryId)
      ) {
        return;
      }
      if (!isAuthenticated) {
        if (onLoginRequired) {
          onLoginRequired();
        } else {
          setSnack(
            t(
              'items.availability.loginRequired',
              'Sign in to check availability with the store.'
            )
          );
        }
        return;
      }
      sendingIds.add(inventoryId);
      emitPendingChange();
      try {
        await requestStockAvailabilityCheck(inventoryId);
        addPendingId(inventoryId);
        setSnack(
          t(
            'items.availability.requestSent',
            'We’ve asked the store to confirm availability. You’ll be notified when they reply.'
          )
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setSnack(
          msg ||
            t(
              'items.availability.requestFailed',
              'Could not send the availability check. Try again shortly.'
            )
        );
      } finally {
        sendingIds.delete(inventoryId);
        emitPendingChange();
      }
    },
    [isAuthenticated, onLoginRequired, t]
  );

  return {
    requestCheck,
    isPending,
    isSending,
    snack,
    clearSnack,
  };
}
