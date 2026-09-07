import { useCallback, useEffect, useMemo, useState } from 'react';
import { businessReferralReviewApi } from '../services/businessReferralReviewApi';
import type {
  BusinessReferralReviewDetail,
  ItemQualityMark,
} from '../types/businessReferralReview';
import { GOLDEN_ITEMS_PER_REFERRAL } from '../types/adminPerformance';

export function useBusinessReferralReviewScreen(businessId: string) {
  const [detail, setDetail] = useState<BusinessReferralReviewDetail | null>(
    null
  );
  const [marks, setMarks] = useState<Record<string, ItemQualityMark>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await businessReferralReviewApi.fetchDetail(businessId);
      setDetail(data);
      const next: Record<string, ItemQualityMark> = {};
      for (const item of data.items) {
        if (item.qualityMark) next[item.id] = item.qualityMark;
      }
      setMarks(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setItemMark = useCallback((itemId: string, quality: ItemQualityMark) => {
    setMarks((prev) => ({ ...prev, [itemId]: quality }));
  }, []);

  const goodCount = useMemo(
    () => Object.values(marks).filter((q) => q === 'good').length,
    [marks]
  );
  const badCount = useMemo(
    () => Object.values(marks).filter((q) => q === 'bad').length,
    [marks]
  );
  const softWarnApprove = goodCount < GOLDEN_ITEMS_PER_REFERRAL;
  const locked = detail?.isPaid === true;

  const itemMarksPayload = useMemo(
    () =>
      Object.entries(marks).map(([itemId, quality]) => ({ itemId, quality })),
    [marks]
  );

  const submitApprove = useCallback(async () => {
    if (!detail || locked) return;
    setSubmitting(true);
    setError(null);
    try {
      await businessReferralReviewApi.submit(businessId, {
        decision: 'approve',
        itemMarks: itemMarksPayload,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setSubmitting(false);
    }
  }, [businessId, detail, itemMarksPayload, load, locked]);

  const submitReject = useCallback(async () => {
    if (!detail || locked) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('rejection_required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await businessReferralReviewApi.submit(businessId, {
        decision: 'reject',
        rejectionReason: reason,
        itemMarks: itemMarksPayload,
      });
      setRejectVisible(false);
      setRejectReason('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setSubmitting(false);
    }
  }, [
    businessId,
    detail,
    itemMarksPayload,
    load,
    locked,
    rejectReason,
  ]);

  return {
    detail,
    marks,
    loading,
    submitting,
    error,
    locked,
    goodCount,
    badCount,
    softWarnApprove,
    rejectVisible,
    rejectReason,
    setRejectVisible,
    setRejectReason,
    setItemMark,
    submitApprove,
    submitReject,
    reload: load,
    goldenTarget: GOLDEN_ITEMS_PER_REFERRAL,
  };
}
