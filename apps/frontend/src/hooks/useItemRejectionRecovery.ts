import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
  RecoveryItemSnapshot,
} from '../types/itemRejectionRecovery';
import { createItemRejectionRecoveryApi } from '../services/itemRejectionRecoveryApi';
import {
  getAppealTileDisabledReason,
  isResubmitEnabled,
  shouldShowRecoveryCard,
  shouldWarnAppealWithdraw,
  synthesizeRecoveryFromItem,
} from '../utils/itemRejectionRecovery';
import { useApiClient } from './useApiClient';

export function useItemRejectionRecovery(
  itemId: string | undefined,
  snapshot?: RecoveryItemSnapshot | null
) {
  const client = useApiClient();
  const api = useMemo(() => createItemRejectionRecoveryApi(client), [client]);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const snapshotKey = [
    snapshot?.id,
    snapshot?.moderation_status,
    snapshot?.rejection_reason,
    snapshot?.rejection_category,
    snapshot?.ai_tokens,
    snapshot?.current_appeal?.id,
    snapshot?.current_appeal?.status,
  ].join('|');
  const [recovery, setRecovery] = useState<ItemRejectionRecovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await api.getRecovery(itemId, snapshotRef.current);
      setRecovery(next);
    } catch (err: any) {
      if (snapshotRef.current) {
        setRecovery(synthesizeRecoveryFromItem(snapshotRef.current));
      }
      setError(err?.message || 'Failed to load recovery');
    } finally {
      setLoading(false);
    }
  }, [api, itemId, snapshotKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const markChanged = useCallback(() => setHasLocalChanges(true), []);

  const submitResubmit = useCallback(
    async (confirmAppealWithdraw?: boolean) => {
      if (!itemId) throw new Error('Missing item');
      const result = await api.resubmit(itemId, confirmAppealWithdraw);
      setRecovery((current) =>
        current
          ? {
              ...current,
              moderation_status: result.moderation_status,
              pending_resubmit: true,
              appeal:
                result.withdrawn_appeal_id && current.appeal
                  ? { ...current.appeal, status: 'withdrawn' }
                  : current.appeal,
            }
          : current
      );
      return result;
    },
    [api, itemId]
  );

  const submitAppeal = useCallback(
    async (reason: string, evidenceUrls?: string[]) => {
      if (!itemId) throw new Error('Missing item');
      const appeal = await api.createAppeal(itemId, {
        reason,
        evidence_urls: evidenceUrls,
      });
      setRecovery((current) =>
        current
          ? {
              ...current,
              appeal,
              appeal_allowance_remaining: 0,
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
      const result = await api.updateCondition(itemId, {
        condition,
        wear_note: wearNote,
      });
      setRecovery((current) =>
        current
          ? { ...current, condition: result.condition, wear_note: result.wear_note }
          : current
      );
      setHasLocalChanges(true);
      return result;
    },
    [api, itemId]
  );

  const uploadEvidence = useCallback(
    async (file: File) => {
      if (!itemId) throw new Error('Missing item');
      return api.uploadEvidence(itemId, file);
    },
    [api, itemId]
  );

  const translateText = useCallback(
    (text: string, targetLanguage: 'en' | 'fr') =>
      api.translateText(text, targetLanguage),
    [api]
  );

  const visible = shouldShowRecoveryCard(recovery);
  const locked = Boolean(recovery?.pending_resubmit);
  const appealDisabledReason = recovery
    ? getAppealTileDisabledReason({
        allowed: recovery.allowed_actions.appeal,
        pendingResubmit: recovery.pending_resubmit,
        allowanceRemaining: recovery.appeal_allowance_remaining,
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
    uploadEvidence,
    translateText,
    getCleanupCost: api.getCleanupCost,
    canResubmit: isResubmitEnabled({
      allowed: Boolean(recovery?.allowed_actions.resubmit),
      locked,
    }),
    warnAppealWithdraw: shouldWarnAppealWithdraw(recovery?.appeal?.status),
    appealDisabledReason,
    setAppeal: (appeal: ItemAppeal) =>
      setRecovery((current) => (current ? { ...current, appeal } : current)),
  };
}
