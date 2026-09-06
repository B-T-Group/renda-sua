import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../services/businessApi';

const POLL_MS = 15_000;
const TERMINAL_JOB = new Set([
  'ready_for_review',
  'failed',
  'completed',
  'cancelled',
]);

export type EnhancementToast = {
  id: string;
  message: string;
  resultId?: string;
  jobId?: string;
  canRevert?: boolean;
};

type TrackedJob = {
  jobId: string;
  imageIds: string[];
};

function imageIdsFromJob(job: {
  results?: Array<{
    business_image_id?: string | null;
    item_variant_image_id?: string | null;
    rental_item_image_id?: string | null;
  }>;
}): string[] {
  const ids: string[] = [];
  for (const r of job.results ?? []) {
    const id =
      r.business_image_id ?? r.item_variant_image_id ?? r.rental_item_image_id;
    if (id) ids.push(id);
  }
  return ids;
}

function isAutoApplied(result: {
  status: string;
  applied_at?: string | null;
  reverted_at?: string | null;
}): boolean {
  return (
    result.status === 'accepted' &&
    !!result.applied_at &&
    !result.reverted_at
  );
}

export function useImageEnhancements(options?: {
  hydrateActivity?: boolean;
}) {
  const { t } = useTranslation();
  const [tracked, setTracked] = useState<TrackedJob[]>([]);
  const [enhancingImageIds, setEnhancingImageIds] = useState<string[]>([]);
  const [toastQueue, setToastQueue] = useState<EnhancementToast[]>([]);
  const [busyResultId, setBusyResultId] = useState<string | null>(null);
  const seenAppliedRef = useRef<Set<string>>(new Set());
  const seenReviewRef = useRef<Set<string>>(new Set());
  const hydrateDoneRef = useRef(false);

  const activeToast = toastQueue[0] ?? null;

  const markEnhancing = useCallback((imageIds: string[], on: boolean) => {
    if (!imageIds.length) return;
    setEnhancingImageIds((prev) => {
      if (on) return [...new Set([...prev, ...imageIds])];
      const drop = new Set(imageIds);
      return prev.filter((id) => !drop.has(id));
    });
  }, []);

  const enqueueToast = useCallback((toast: EnhancementToast) => {
    setToastQueue((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback(() => {
    setToastQueue((prev) => prev.slice(1));
  }, []);

  const trackJob = useCallback(
    (jobId: string, imageIds: string[] = []) => {
      setTracked((prev) => {
        if (prev.some((j) => j.jobId === jobId)) return prev;
        return [...prev, { jobId, imageIds }];
      });
      markEnhancing(imageIds, true);
      enqueueToast({
        id: `enhancing-${jobId}`,
        message: t(
          'business.images.enhancement.enhancing',
          'Enhancing photo…'
        ),
        jobId,
      });
    },
    [enqueueToast, markEnhancing, t]
  );

  const clearTrackedJob = useCallback(
    (jobId: string, imageIds: string[]) => {
      setTracked((prev) => prev.filter((j) => j.jobId !== jobId));
      markEnhancing(imageIds, false);
    },
    [markEnhancing]
  );

  const handleJobPoll = useCallback(
    async (entry: TrackedJob) => {
      const res = await businessApi.aiImageCleanup.getJob(entry.jobId);
      const job = res.data?.job;
      if (!job) return;
      const ids = entry.imageIds.length
        ? entry.imageIds
        : imageIdsFromJob(job);
      if (TERMINAL_JOB.has(job.status)) {
        clearTrackedJob(entry.jobId, ids);
      }
      const applied = (job.results ?? []).filter(isAutoApplied);
      for (const result of applied) {
        if (seenAppliedRef.current.has(result.id)) continue;
        seenAppliedRef.current.add(result.id);
        enqueueToast({
          id: `applied-${result.id}`,
          message: t(
            'business.images.enhancement.applied',
            'Photo enhanced. Hold to compare anytime.'
          ),
          resultId: result.id,
          jobId: entry.jobId,
          canRevert: true,
        });
      }
      if (job.status === 'ready_for_review') {
        if (!seenReviewRef.current.has(entry.jobId)) {
          seenReviewRef.current.add(entry.jobId);
          enqueueToast({
            id: `review-${entry.jobId}`,
            message: t(
              'business.images.enhancement.needsReview',
              'Cleaned photos need your review.'
            ),
            jobId: entry.jobId,
          });
        }
      }
    },
    [clearTrackedJob, enqueueToast, t]
  );

  useEffect(() => {
    if (!tracked.length) return undefined;
    let cancelled = false;
    const poll = async () => {
      for (const entry of tracked) {
        if (cancelled) return;
        try {
          await handleJobPoll(entry);
        } catch {
          // keep polling; transient failures are fine
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tracked, handleJobPoll]);

  useEffect(() => {
    if (!options?.hydrateActivity || hydrateDoneRef.current) return;
    hydrateDoneRef.current = true;
    void (async () => {
      try {
        const res = await businessApi.aiImageCleanup.activity();
        const results = res.data?.results ?? [];
        const recent = results.filter(isAutoApplied).slice(0, 3);
        for (const result of recent) {
          if (seenAppliedRef.current.has(result.id)) continue;
          seenAppliedRef.current.add(result.id);
          enqueueToast({
            id: `activity-${result.id}`,
            message: t(
              'business.images.enhancement.appliedBatch',
              'Photos were auto-enhanced.'
            ),
            resultId: result.id,
            canRevert: true,
          });
        }
      } catch {
        // optional hydration
      }
    })();
  }, [enqueueToast, options?.hydrateActivity, t]);

  const revert = useCallback(
    async (resultId: string) => {
      setBusyResultId(resultId);
      try {
        await businessApi.aiImageCleanup.revert(resultId);
        enqueueToast({
          id: `reverted-${resultId}`,
          message: t(
            'business.images.enhancement.reverted',
            'Restored original photo'
          ),
          resultId,
        });
      } finally {
        setBusyResultId(null);
      }
    },
    [enqueueToast, t]
  );

  const revertFromToast = useCallback(async () => {
    const toast = toastQueue[0];
    if (!toast?.resultId || !toast.canRevert) {
      dismissToast();
      return;
    }
    try {
      await revert(toast.resultId);
    } catch {
      enqueueToast({
        id: `revert-fail-${toast.resultId}`,
        message: t(
          'business.images.enhancement.revertFailed',
          'Could not restore original'
        ),
      });
    } finally {
      dismissToast();
    }
  }, [dismissToast, enqueueToast, revert, t, toastQueue]);

  const isEnhancing = useCallback(
    (imageId: string) => enhancingImageIds.includes(imageId),
    [enhancingImageIds]
  );

  return {
    trackJob,
    inFlightJobIds: tracked.map((j) => j.jobId),
    enhancingImageIds,
    isEnhancing,
    activeToast,
    dismissToast,
    revert,
    revertFromToast,
    busyResultId,
  };
}
