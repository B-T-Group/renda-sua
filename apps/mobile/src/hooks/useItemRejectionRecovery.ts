import { useCallback, useEffect, useState } from 'react';
import type {
  ItemCondition,
  ItemRejectionRecovery,
} from '../types/itemRejectionRecovery';
import { itemRejectionRecoveryApi } from '../services/itemRejectionRecoveryApi';
import {
  getAppealTileDisabledReason,
  isResubmitEnabled,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
} from '../utils/itemRejectionRecovery';

export function useItemRejectionRecovery(itemId: string | undefined) {
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
      const next = await itemRejectionRecoveryApi.getRecovery(itemId);
      setRecovery(next);
      if (next.item.moderationStatus === 'rejected') setPendingResubmit(false);
    } catch (err: unknown) {
      setRecovery(null);
      setError(err instanceof Error ? err.message : 'Failed to load recovery');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markChanged = useCallback(() => setHasLocalChanges(true), []);

  const submitResubmit = useCallback(
    async (confirmWithdrawAppeal?: boolean) => {
      if (!itemId) throw new Error('Missing item');
      const result = await itemRejectionRecoveryApi.resubmit(
        itemId,
        confirmWithdrawAppeal
      );
      setPendingResubmit(true);
      setRecovery((current) => applyResubmit(current, result.withdrewAppealId));
      return result;
    },
    [itemId]
  );

  const submitAppeal = useCallback(
    async (reason: string, evidenceUrls?: string[]) => {
      if (!itemId) throw new Error('Missing item');
      const appeal = await itemRejectionRecoveryApi.createAppeal(itemId, {
        reason,
        evidenceUrls,
      });
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
    [itemId]
  );

  const saveCondition = useCallback(
    async (condition: ItemCondition, wearNote?: string | null) => {
      if (!itemId) throw new Error('Missing item');
      const result = await itemRejectionRecoveryApi.updateCondition(itemId, {
        condition,
        wearNote,
      });
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
    [itemId]
  );

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
    uploadEvidence: (file: {
      uri: string;
      fileName: string;
      contentType: string;
      fileSize?: number;
    }) => {
      if (!itemId) return Promise.reject(new Error('Missing item'));
      return itemRejectionRecoveryApi.uploadEvidence(itemId, file);
    },
    translateText: itemRejectionRecoveryApi.translateText,
    getCleanupQuote: itemRejectionRecoveryApi.getCleanupQuote,
    canResubmit: isResubmitEnabled({
      allowed: Boolean(recovery?.canResubmit),
      locked,
    }),
    warnAppealWithdraw:
      shouldWarnAppealWithdraw(recovery?.appeal?.status) ||
      Boolean(recovery?.resubmitWithdrawsAppeal),
    appealDisabledReason,
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
