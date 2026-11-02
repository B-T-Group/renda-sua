import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
} from '../types/itemRejectionRecovery';
import { createItemRejectionRecoveryApi } from '../services/itemRejectionRecoveryApi';
import {
  getAppealTileDisabledReason,
  isResubmitEnabled,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
} from '../utils/itemRejectionRecovery';
import { useApiClient } from './useApiClient';
import { useRefreshExpiredEvidence } from './useRefreshExpiredEvidence';

export function useItemRejectionRecovery(itemId: string | undefined) {
  const client = useApiClient();
  const api = useMemo(() => createItemRejectionRecoveryApi(client), [client]);
  const [recovery, setRecovery] = useState<ItemRejectionRecovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [pendingResubmit, setPendingResubmit] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await api.getRecovery(itemId);
      setRecovery(next);
      if (next.item.moderationStatus === 'rejected') setPendingResubmit(false);
    } catch (err: any) {
      setRecovery(null);
      setError(err?.message || 'Failed to load recovery');
    } finally {
      setLoading(false);
    }
  }, [api, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markChanged = useCallback(() => setHasLocalChanges(true), []);

  const submitResubmit = useCallback(
    async (confirmWithdrawAppeal?: boolean) => {
      if (!itemId) throw new Error('Missing item');
      const result = await api.resubmit(itemId, confirmWithdrawAppeal);
      setPendingResubmit(true);
      setRecovery((current) => applyResubmit(current, result.withdrewAppealId));
      return result;
    },
    [api, itemId]
  );

  const submitAppeal = useCallback(
    async (reason: string, evidenceKeys?: string[]) => {
      if (!itemId) throw new Error('Missing item');
      const appeal = await api.createAppeal(itemId, { reason, evidenceKeys });
      setRecovery((current) =>
        current
          ? {
              ...current,
              appeal,
              canAppeal: false,
              appealsUsed: current.appealsUsed + 1,
              resubmitWithdrawsAppeal: true,
            }
          : current
      );
      return appeal;
    },
    [api, itemId]
  );

  const saveCondition = useCallback(
    async (condition: ItemCondition, wearNote?: string | null) => {
      if (!itemId) throw new Error('Missing item');
      const result = await api.updateCondition(itemId, { condition, wearNote });
      setRecovery((current) =>
        current
          ? {
              ...current,
              item: {
                ...current.item,
                condition: result.condition,
                wearNote: result.wearNote,
              },
            }
          : current
      );
      setHasLocalChanges(true);
      return result;
    },
    [api, itemId]
  );

  useRefreshExpiredEvidence(recovery?.appeal?.evidence, load);

  const visible = shouldShowRecoveryCard(recovery, pendingResubmit);
  const locked = pendingResubmit;
  const appealDisabledReason = recovery
    ? getAppealTileDisabledReason({
        canAppeal: recovery.canAppeal,
        pendingResubmit,
        appealsUsed: recovery.appealsUsed,
        appealLimit: recovery.appealLimit,
        appealStatus: recovery.appeal?.status,
      })
    : 'not_allowed';

  return {
    recovery,
    loading,
    error,
    visible,
    locked,
    hasLocalChanges,
    markChanged,
    reload: load,
    submitResubmit,
    submitAppeal,
    saveCondition,
    uploadEvidence: (file: File) => {
      if (!itemId) return Promise.reject(new Error('Missing item'));
      return api.uploadEvidence(itemId, file);
    },
    translateText: api.translateText,
    getCleanupQuote: api.getCleanupQuote,
    canResubmit: isResubmitEnabled({
      allowed: Boolean(recovery?.canResubmit),
      locked,
    }),
    warnAppealWithdraw:
      shouldWarnAppealWithdraw(recovery?.appeal?.status) ||
      Boolean(recovery?.resubmitWithdrawsAppeal),
    appealDisabledReason,
    setAppeal: (appeal: ItemAppeal) =>
      setRecovery((current) => (current ? { ...current, appeal } : current)),
  };
}

function applyResubmit(
  current: ItemRejectionRecovery | null,
  withdrewAppealId: string | null
): ItemRejectionRecovery | null {
  if (!current) return current;
  return {
    ...current,
    item: { ...current.item, moderationStatus: 'pending', statusDisplay: 'in_review' },
    canResubmit: false,
    canAppeal: false,
    resubmitWithdrawsAppeal: false,
    appeal:
      withdrewAppealId && current.appeal
        ? { ...current.appeal, status: 'withdrawn' }
        : current.appeal,
  };
}
