import { Button } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import ImageEnhancementCompareDialog from '../components/dialogs/ImageEnhancementCompareDialog';
import {
  useAiImageCleanup,
  type AiImageCleanupResult,
} from './useAiImageCleanup';

const POLL_MS = 15_000;
const SEEN_ACTIVITY_KEY = 'ai_enhancement_seen_result_ids';
const TERMINAL_JOB_STATUSES = new Set([
  'completed',
  'cancelled',
  'failed',
  'ready_for_review',
]);

function loadSeenResultIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_ACTIVITY_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function persistSeenResultIds(ids: Set<string>): void {
  try {
    const trimmed = Array.from(ids).slice(-200);
    sessionStorage.setItem(SEEN_ACTIVITY_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore quota / private mode.
  }
}
export interface EnhancementToastPayload {
  resultId: string;
  originalUrl: string;
  enhancedUrl: string;
  changes?: string[] | null;
  confidenceTier?: string | null;
  reverted?: boolean;
}

interface ImageEnhancementsContextValue {
  inFlightJobIds: string[];
  pendingToast: EnhancementToastPayload | null;
  trackJob: (jobId: string) => void;
  dismissToast: () => void;
  revertFromToast: () => Promise<void>;
  openComparison: (payload?: EnhancementToastPayload) => void;
  closeComparison: () => void;
  hydrateActivity: () => Promise<void>;
}

const ImageEnhancementsContext =
  createContext<ImageEnhancementsContextValue | null>(null);

function isAutoApplied(result: AiImageCleanupResult): boolean {
  return (
    result.status === 'accepted' &&
    !!result.applied_at &&
    !result.reverted_at &&
    !!result.cleaned_image_url
  );
}

function toToastPayload(
  result: AiImageCleanupResult
): EnhancementToastPayload | null {
  if (!result.cleaned_image_url) return null;
  return {
    resultId: result.id,
    originalUrl: result.original_image_url,
    enhancedUrl: result.cleaned_image_url,
    changes: result.changes,
    confidenceTier: result.confidence_tier,
    reverted: !!result.reverted_at,
  };
}

function collectAutoApplied(
  results: AiImageCleanupResult[],
  seen: Set<string>
): EnhancementToastPayload[] {
  const out: EnhancementToastPayload[] = [];
  for (const result of results) {
    if (seen.has(result.id) || !isAutoApplied(result)) continue;
    const payload = toToastPayload(result);
    if (payload) out.push(payload);
  }
  return out;
}

export function ImageEnhancementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { getJob, getActivity, revertResult, reapplyResult } =
    useAiImageCleanup();

  const [inFlightJobIds, setInFlightJobIds] = useState<string[]>([]);
  const [pendingToast, setPendingToast] =
    useState<EnhancementToastPayload | null>(null);
  const [comparison, setComparison] =
    useState<EnhancementToastPayload | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);

  const seenResultIdsRef = useRef<Set<string>>(loadSeenResultIds());
  const toastQueueRef = useRef<EnhancementToastPayload[]>([]);
  const activeSnackKeyRef = useRef<string | number | null>(null);
  const pendingToastRef = useRef<EnhancementToastPayload | null>(null);

  const closeComparison = useCallback(() => {
    setComparison(null);
  }, []);

  const openComparison = useCallback((payload?: EnhancementToastPayload) => {
    const target = payload ?? pendingToastRef.current;
    if (!target) return;
    setComparison(target);
  }, []);

  const showSnackForPayload = useCallback(
    (payload: EnhancementToastPayload) => {
      if (activeSnackKeyRef.current != null) {
        closeSnackbar(activeSnackKeyRef.current);
      }
      pendingToastRef.current = payload;
      setPendingToast(payload);
      activeSnackKeyRef.current = enqueueSnackbar(
        t(
          'business.aiImageCleanup.enhancedToast',
          'Photo enhanced — tap to compare or revert'
        ),
        {
          variant: 'success',
          persist: true,
          action: (key) => (
            <>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  openComparison(payload);
                  closeSnackbar(key);
                  activeSnackKeyRef.current = null;
                  pendingToastRef.current = null;
                  setPendingToast(null);
                  const next = toastQueueRef.current.shift() ?? null;
                  if (next) showSnackForPayload(next);
                }}
              >
                {t('business.aiImageCleanup.compare', 'Compare')}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  void revertResult(payload.resultId)
                    .then(() => {
                      enqueueSnackbar(
                        t(
                          'business.aiImageCleanup.revertSuccess',
                          'Restored original photo'
                        ),
                        { variant: 'success' }
                      );
                    })
                    .catch((e: any) => {
                      enqueueSnackbar(
                        e?.message ||
                          t(
                            'business.aiImageCleanup.actionFailed',
                            'Action failed'
                          ),
                        { variant: 'error' }
                      );
                    })
                    .finally(() => {
                      closeSnackbar(key);
                      activeSnackKeyRef.current = null;
                      pendingToastRef.current = null;
                      setPendingToast(null);
                      const next = toastQueueRef.current.shift() ?? null;
                      if (next) showSnackForPayload(next);
                    });
                }}
              >
                {t('business.aiImageCleanup.revert', 'Revert')}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  closeSnackbar(key);
                  activeSnackKeyRef.current = null;
                  pendingToastRef.current = null;
                  setPendingToast(null);
                  const next = toastQueueRef.current.shift() ?? null;
                  if (next) showSnackForPayload(next);
                }}
              >
                {t('common.dismiss', 'Dismiss')}
              </Button>
            </>
          ),
        }
      );
    },
    [closeSnackbar, enqueueSnackbar, openComparison, revertResult, t]
  );

  const enqueueToastPayload = useCallback(
    (payload: EnhancementToastPayload) => {
      seenResultIdsRef.current.add(payload.resultId);
      persistSeenResultIds(seenResultIdsRef.current);
      if (pendingToastRef.current) {
        toastQueueRef.current.push(payload);
        return;
      }
      showSnackForPayload(payload);
    },
    [showSnackForPayload]
  );

  const dismissToast = useCallback(() => {
    if (activeSnackKeyRef.current != null) {
      closeSnackbar(activeSnackKeyRef.current);
      activeSnackKeyRef.current = null;
    }
    pendingToastRef.current = null;
    setPendingToast(null);
    const next = toastQueueRef.current.shift() ?? null;
    if (next) showSnackForPayload(next);
  }, [closeSnackbar, showSnackForPayload]);

  const revertFromToast = useCallback(async () => {
    const current = pendingToastRef.current;
    if (!current) return;
    await revertResult(current.resultId);
    dismissToast();
  }, [dismissToast, revertResult]);

  const trackJob = useCallback((jobId: string) => {
    if (!jobId) return;
    setInFlightJobIds((prev) =>
      prev.includes(jobId) ? prev : [...prev, jobId]
    );
  }, []);

  const processJob = useCallback(
    async (jobId: string) => {
      const job = await getJob(jobId);
      if (!job) return;
      collectAutoApplied(job.results ?? [], seenResultIdsRef.current).forEach(
        enqueueToastPayload
      );
      if (TERMINAL_JOB_STATUSES.has(job.status)) {
        setInFlightJobIds((prev) => prev.filter((id) => id !== jobId));
      }
    },
    [enqueueToastPayload, getJob]
  );

  const pollInFlight = useCallback(async () => {
    for (const jobId of inFlightJobIds) {
      try {
        await processJob(jobId);
      } catch {
        // Keep polling through transient errors.
      }
    }
  }, [inFlightJobIds, processJob]);

  useEffect(() => {
    if (inFlightJobIds.length === 0) return undefined;
    void pollInFlight();
    const timer = window.setInterval(() => {
      void pollInFlight();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [inFlightJobIds, pollInFlight]);

  const hydrateActivity = useCallback(async () => {
    try {
      const data = await getActivity();
      collectAutoApplied(data.results ?? [], seenResultIdsRef.current).forEach(
        enqueueToastPayload
      );
    } catch {
      // Optional hydration.
    }
  }, [enqueueToastPayload, getActivity]);

  const handleUseOriginal = useCallback(async () => {
    if (!comparison) return;
    setCompareBusy(true);
    try {
      await revertResult(comparison.resultId);
      setComparison({ ...comparison, reverted: true });
      enqueueSnackbar(
        t('business.aiImageCleanup.revertSuccess', 'Restored original photo'),
        { variant: 'success' }
      );
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.aiImageCleanup.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    } finally {
      setCompareBusy(false);
    }
  }, [comparison, enqueueSnackbar, revertResult, t]);

  const handleUseEnhanced = useCallback(async () => {
    if (!comparison) return;
    setCompareBusy(true);
    try {
      await reapplyResult(comparison.resultId);
      setComparison({ ...comparison, reverted: false });
      enqueueSnackbar(
        t('business.aiImageCleanup.reapplySuccess', 'Enhanced photo restored'),
        { variant: 'success' }
      );
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.aiImageCleanup.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    } finally {
      setCompareBusy(false);
    }
  }, [comparison, enqueueSnackbar, reapplyResult, t]);

  const value = useMemo<ImageEnhancementsContextValue>(
    () => ({
      inFlightJobIds,
      pendingToast,
      trackJob,
      dismissToast,
      revertFromToast,
      openComparison,
      closeComparison,
      hydrateActivity,
    }),
    [
      closeComparison,
      dismissToast,
      hydrateActivity,
      inFlightJobIds,
      openComparison,
      pendingToast,
      revertFromToast,
      trackJob,
    ]
  );

  return (
    <ImageEnhancementsContext.Provider value={value}>
      {children}
      <ImageEnhancementCompareDialog
        open={comparison != null}
        onClose={closeComparison}
        originalUrl={comparison?.originalUrl ?? ''}
        enhancedUrl={comparison?.enhancedUrl ?? ''}
        changes={comparison?.changes}
        busy={compareBusy}
        useOriginalDisabled={!comparison || comparison.reverted === true}
        useEnhancedDisabled={!comparison || comparison.reverted !== true}
        onUseOriginal={() => void handleUseOriginal()}
        onUseEnhanced={() => void handleUseEnhanced()}
      />
    </ImageEnhancementsContext.Provider>
  );
}

export function useImageEnhancements(): ImageEnhancementsContextValue {
  const ctx = useContext(ImageEnhancementsContext);
  if (!ctx) {
    throw new Error(
      'useImageEnhancements must be used within ImageEnhancementsProvider'
    );
  }
  return ctx;
}
