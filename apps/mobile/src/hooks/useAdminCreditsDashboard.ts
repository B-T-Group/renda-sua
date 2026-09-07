import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformPermissions } from '@/constants/platformPermissions';
import {
  fetchCreditsCancelledQueue,
  fetchCreditsEscalations,
  fetchCreditsFirstOrderQueue,
  fetchCreditsSummary,
  resolveCreditsEscalation,
  submitCancelledFeedback,
  submitFirstOrderFeedback,
} from '@/services/adminCreditsApi';
import type {
  AdminCreditsTab,
  CreditsEscalationRow,
  CreditsFeedbackOrderRow,
  CreditsSummaryRow,
  CreditEventType,
  CreditFeedbackAction,
  OrderFeedbackCreditBody,
  ResolveEscalationCreditBody,
} from '@/types/adminCredits';
import { usePermission } from './usePermissions';
import { useProfileMe } from './useProfileMe';

export interface AdminCreditsFeedback {
  type: 'success' | 'error';
  message: string;
}

export function useAdminCreditsDashboard() {
  const { t } = useTranslation();
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.OPS_CREDITS, me);
  const loadRequestIdRef = useRef(0);

  const [tab, setTab] = useState<AdminCreditsTab>('escalations');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminCreditsFeedback | null>(null);

  const [escalations, setEscalations] = useState<CreditsEscalationRow[]>([]);
  const [cancelled, setCancelled] = useState<CreditsFeedbackOrderRow[]>([]);
  const [firstOrders, setFirstOrders] = useState<CreditsFeedbackOrderRow[]>([]);
  const [summary, setSummary] = useState<CreditsSummaryRow[]>([]);
  const [weights, setWeights] = useState<Partial<Record<CreditEventType, number>>>(
    {}
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      const requestId = ++loadRequestIdRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = country ? { country } : undefined;
        const [s, e, c, f] = await Promise.all([
          fetchCreditsSummary(params),
          fetchCreditsEscalations(params),
          fetchCreditsCancelledQueue(params),
          fetchCreditsFirstOrderQueue(params),
        ]);
        if (requestId !== loadRequestIdRef.current) return;
        setSummary(s.items ?? []);
        setWeights(s.weights ?? {});
        setEscalations(e.items ?? []);
        setCancelled(c.items ?? []);
        setFirstOrders(f.items ?? []);
      } catch (err: any) {
        if (requestId !== loadRequestIdRef.current) return;
        setError(
          err?.message ??
            t('admin.credits.loadFailed', 'Could not load follow-ups')
        );
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, country, t]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  const runAction = useCallback(
    async (
      action: () => Promise<string | void>,
      successMessage?: string
    ) => {
      setSubmitting(true);
      setFeedback(null);
      try {
        const dynamicMessage = await action();
        await load({ silent: true });
        setFeedback({
          type: 'success',
          message:
            (typeof dynamicMessage === 'string' && dynamicMessage) ||
            successMessage ||
            t('admin.credits.feedbackSaved', 'Feedback recorded'),
        });
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message:
            err?.message ?? t('admin.credits.actionFailed', 'Action failed'),
        });
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [load, t]
  );

  const resolveEscalation = useCallback(
    (incidentId: string, body: ResolveEscalationCreditBody) =>
      runAction(
        async () => {
          await resolveCreditsEscalation(incidentId, body);
        },
        t('admin.credits.resolveSuccess', 'Escalation resolved')
      ),
    [runAction, t]
  );

  const saveCancelledFeedback = useCallback(
    (orderId: string, body: OrderFeedbackCreditBody) =>
      runAction(async () => {
        const res = await submitCancelledFeedback(orderId, body);
        return feedbackSuccessMessage(body.action, res, t);
      }),
    [runAction, t]
  );

  const saveFirstOrderFeedback = useCallback(
    (orderId: string, body: OrderFeedbackCreditBody) =>
      runAction(async () => {
        const res = await submitFirstOrderFeedback(orderId, body);
        return feedbackSuccessMessage(body.action, res, t);
      }),
    [runAction, t]
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);

  useEffect(() => {
    if (!profileLoading && canAccess) void load();
  }, [canAccess, load, profileLoading]);

  return {
    tab,
    setTab,
    country,
    setCountry,
    canAccess,
    profileLoading,
    loading,
    refreshing,
    submitting,
    error,
    feedback,
    clearFeedback,
    escalations,
    cancelled,
    firstOrders,
    summary,
    weights,
    refresh,
    resolveEscalation,
    saveCancelledFeedback,
    saveFirstOrderFeedback,
  };
}

function feedbackSuccessMessage(
  action: CreditFeedbackAction,
  res: { classification?: string } | undefined,
  t: (key: string, fallback: string) => string
): string {
  const classification =
    res?.classification ??
    (action === 'test_order'
      ? 'test'
      : action === 'internal_order'
        ? 'internal'
        : null);
  if (classification === 'test') {
    return t('admin.credits.markedTest', 'Marked as test order (no points)');
  }
  if (classification === 'internal') {
    return t(
      'admin.credits.markedInternal',
      'Marked as internal order (no points)'
    );
  }
  return t('admin.credits.feedbackSaved', 'Feedback recorded');
}
