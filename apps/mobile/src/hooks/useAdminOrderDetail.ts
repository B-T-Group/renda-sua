import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformPermissions } from '../constants/platformPermissions';
import {
  acknowledgeAdminRiskIncident,
  addAdminOrderNote,
  fetchAdminOrderDetail,
  sendAdminOrderMessage,
  sendAdminOrderSms,
  unassignAndRedispatchOrder,
} from '../services/adminOrdersApi';
import type { AdminOrderDetail, OrderContactRole } from '../types/adminOrders';
import { usePermissions } from './usePermissions';
import { useProfileMe } from './useProfileMe';

export interface AdminOrderActionFeedback {
  type: 'success' | 'error';
  message: string;
}

export function useAdminOrderDetail(orderId: string) {
  const { t } = useTranslation();
  const { me, loading: profileLoading } = useProfileMe();
  const { can } = usePermissions(me);
  const canAccess =
    can(PlatformPermissions.ORDERS_CROSS_BUSINESS) ||
    can(PlatformPermissions.OPS_CREDITS);

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminOrderActionFeedback | null>(
    null
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        setOrder(await fetchAdminOrderDetail(orderId));
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load order');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccess, orderId]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  /**
   * Runs an intervention, then refreshes so risk state reflects the outcome.
   * Failures are surfaced through `feedback` and still rethrown so callers that
   * render their own inline error (the contact sheet) can keep the form open.
   */
  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setSubmitting(true);
      setFeedback(null);
      try {
        await action();
        await load({ silent: true });
        setFeedback({ type: 'success', message: successMessage });
      } catch (e: any) {
        setFeedback({
          type: 'error',
          message:
            e?.message ?? t('admin.orders.actionFailed', 'Action failed'),
        });
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [load, t]
  );

  const sendMessage = useCallback(
    (recipient: OrderContactRole, message: string) =>
      runAction(
        () => sendAdminOrderMessage(orderId, recipient, message),
        t('admin.orders.messageSent', 'Message sent')
      ),
    [orderId, runAction, t]
  );

  const sendSms = useCallback(
    (recipient: OrderContactRole, message: string) =>
      runAction(
        () => sendAdminOrderSms(orderId, recipient, message),
        t('admin.orders.smsSent', 'SMS sent')
      ),
    [orderId, runAction, t]
  );

  const redispatch = useCallback(
    (reason?: string) =>
      runAction(
        () => unassignAndRedispatchOrder(orderId, reason),
        t('admin.orders.redispatchSuccess', 'Order redispatched')
      ),
    [orderId, runAction, t]
  );

  const addNote = useCallback(
    (note: string) =>
      runAction(
        () => addAdminOrderNote(orderId, note),
        t('admin.orders.noteSaved', 'Note added')
      ),
    [orderId, runAction, t]
  );

  const acknowledgeIncident = useCallback(
    (
      incidentId: string,
      opts?: {
        resolve?: boolean;
        note?: string;
        contact_channel?: string;
        order_result?: string;
      }
    ) =>
      runAction(
        () =>
          acknowledgeAdminRiskIncident({
            incidentId,
            resolve: opts?.resolve,
            note: opts?.note,
            contact_channel: opts?.contact_channel,
            order_result: opts?.order_result,
          }),
        opts?.resolve
          ? t('admin.orders.resolveSuccess', 'Risk marked resolved')
          : t('admin.orders.acknowledgeSuccess', 'Risk acknowledged')
      ),
    [runAction, t]
  );

  const resolveIncident = useCallback(
    (
      incidentId: string,
      payload: {
        contact_channel: string;
        order_result: string;
        notes: string;
      }
    ) =>
      acknowledgeIncident(incidentId, {
        resolve: true,
        note: payload.notes,
        contact_channel: payload.contact_channel,
        order_result: payload.order_result,
      }),
    [acknowledgeIncident]
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);

  useEffect(() => {
    if (!profileLoading && canAccess) void load();
  }, [canAccess, load, profileLoading]);

  return {
    order,
    loading,
    refreshing,
    submitting,
    error,
    feedback,
    clearFeedback,
    canAccess,
    profileLoading,
    refresh,
    sendMessage,
    sendSms,
    redispatch,
    addNote,
    acknowledgeIncident,
    resolveIncident,
  };
}
