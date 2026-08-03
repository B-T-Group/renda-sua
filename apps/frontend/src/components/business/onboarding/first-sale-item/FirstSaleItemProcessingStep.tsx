import {
  CheckCircle as CheckIcon,
  ErrorOutline as ErrorIcon,
  RadioButtonUnchecked as PendingIcon,
  RemoveCircleOutline as SkippedIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useAiImageCleanup } from '../../../../hooks/useAiImageCleanup';
import { useAws } from '../../../../hooks/useAws';
import { useApiClient } from '../../../../hooks/useApiClient';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useCreateItemFromImage } from '../../../../hooks/useCreateItemFromImage';
import { useImageValidation } from '../../../../hooks/useImageValidation';
import type { ImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';
import {
  PROCESSING_TIMEOUTS_MS,
  initialProcessingStages,
  withTimeout,
  type ProcessingStageKey,
  type ProcessingStageState,
} from '../../../../utils/productCreateProcessing';
import { presignUploadLibraryImage } from '../onboardingPresignedUpload';

export interface ProcessingCompletePayload {
  imageIds: string[];
  itemId: string;
  suggestions: ImageItemSuggestions | null;
  cleanupQueued: boolean;
}

export interface FirstSaleItemProcessingStepProps {
  files: File[];
  merchantHint: string;
  asyncCleanupRequested: boolean;
  initialImageIds?: string[];
  initialItemId?: string | null;
  initialSuggestions?: ImageItemSuggestions | null;
  /** True when cleanup was already queued for this draft in this session. */
  initialCleanupQueued?: boolean;
  onContinue: (payload: ProcessingCompletePayload) => void;
}

function stageLabel(
  key: ProcessingStageKey,
  t: (k: string, d: string) => string
): string {
  switch (key) {
    case 'upload':
      return t(
        'business.onboarding.firstSale.processing.upload',
        'Uploading photos'
      );
    case 'draft':
      return t(
        'business.onboarding.firstSale.processing.draft',
        'Creating product draft'
      );
    case 'cleanup':
      return t(
        'business.onboarding.firstSale.processing.cleanup',
        'Sending photos for AI cleanup'
      );
    case 'analyze':
      return t(
        'business.onboarding.firstSale.processing.analyze',
        'Analyzing photos & extracting details'
      );
    default:
      return key;
  }
}

function StageStatusIcon({ status }: { status: ProcessingStageState['status'] }) {
  if (status === 'done') return <CheckIcon color="success" fontSize="small" />;
  if (status === 'active') return <CircularProgress size={18} />;
  if (status === 'error') return <ErrorIcon color="error" fontSize="small" />;
  if (status === 'skipped')
    return <SkippedIcon color="disabled" fontSize="small" />;
  return <PendingIcon color="disabled" fontSize="small" />;
}

const FirstSaleItemProcessingStep: React.FC<
  FirstSaleItemProcessingStepProps
> = ({
  files,
  merchantHint,
  asyncCleanupRequested,
  initialImageIds = [],
  initialItemId = null,
  initialSuggestions = null,
  initialCleanupQueued = false,
  onContinue,
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const { generateImageUploadUrl } = useAws();
  const { bulkCreateImages, associateImageToItem } = useBusinessImages();
  const { createItemFromImage } = useCreateItemFromImage();
  const { requestCleanup } = useAiImageCleanup();
  const { validateFiles, metadataFromResults } = useImageValidation();

  const [stages, setStages] = useState(() =>
    initialProcessingStages(asyncCleanupRequested)
  );
  const [complete, setComplete] = useState(false);
  const [failed, setFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingCompletePayload | null>(null);

  const runIdRef = useRef(0);
  const imageIdsRef = useRef<string[]>(initialImageIds);
  const itemIdRef = useRef<string | null>(initialItemId);
  const suggestionsRef = useRef<ImageItemSuggestions | null>(initialSuggestions);
  const cleanupQueuedRef = useRef(initialCleanupQueued);

  const patchStage = useCallback(
    (key: ProcessingStageKey, patch: Partial<ProcessingStageState>) => {
      setStages((prev) =>
        prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
      );
    },
    []
  );

  const uploadFiles = useCallback(async (): Promise<string[]> => {
    if (imageIdsRef.current.length >= files.length && imageIdsRef.current[0]) {
      return imageIdsRef.current;
    }
    const bid = profile?.business?.id;
    if (!bid) throw new Error('Missing business');
    const bucketName =
      process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';
    const prefix = `businesses/${bid}/images`;
    const errMsg = t(
      'business.onboarding.firstSale.upload.presignError',
      'Failed to prepare image upload'
    );
    const validation = await validateFiles(files);
    const meta = metadataFromResults(validation.results);
    const payloads = [];
    for (let i = 0; i < files.length; i++) {
      payloads.push({
        ...(await presignUploadLibraryImage(
          files[i],
          bucketName,
          prefix,
          generateImageUploadUrl,
          errMsg
        )),
        ...meta[i],
      });
    }
    const ids = await bulkCreateImages({ images: payloads }, { skipRefetch: true });
    if (!ids.length) {
      throw new Error(
        t(
          'business.onboarding.firstSale.upload.noIds',
          'Upload did not return image ids'
        )
      );
    }
    return ids.map((r) => r.id);
  }, [
    bulkCreateImages,
    files,
    generateImageUploadUrl,
    metadataFromResults,
    profile?.business?.id,
    t,
    validateFiles,
  ]);

  const fetchSuggestions = useCallback(
    async (ids: string[]): Promise<ImageItemSuggestions | null> => {
      const response = await apiClient.post<{
        success: boolean;
        data?: ImageItemSuggestions;
        error?: string;
      }>('/ai/image-item-suggestions', {
        imageIds: ids,
        ...(merchantHint.trim() ? { hint: merchantHint.trim() } : {}),
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Could not analyze photos');
    },
    [apiClient, merchantHint]
  );

  const runPipeline = useCallback(async () => {
    const runId = ++runIdRef.current;
    setComplete(false);
    setFailed(false);
    setTimedOut(false);
    setError(null);
    setStages(initialProcessingStages(asyncCleanupRequested));

    const overallTimer = setTimeout(() => {
      if (runIdRef.current !== runId) return;
      setTimedOut(true);
      setComplete(true);
      setResult({
        imageIds: imageIdsRef.current,
        itemId: itemIdRef.current || '',
        suggestions: suggestionsRef.current,
        cleanupQueued: cleanupQueuedRef.current,
      });
    }, PROCESSING_TIMEOUTS_MS.overall);

    try {
      patchStage('upload', { status: 'active' });
      const uploadedIds = await withTimeout(
        uploadFiles(),
        PROCESSING_TIMEOUTS_MS.uploadOverall,
        'Upload'
      );
      if (runIdRef.current !== runId) return;
      imageIdsRef.current = uploadedIds;
      patchStage('upload', { status: 'done' });

      patchStage('draft', { status: 'active' });
      let itemId = itemIdRef.current;
      if (!itemId) {
        const res = await withTimeout(
          createItemFromImage({
            imageId: uploadedIds[0],
            name: merchantHint.trim() || undefined,
            hint: merchantHint.trim() || undefined,
          }),
          PROCESSING_TIMEOUTS_MS.draft,
          'Draft'
        );
        if (runIdRef.current !== runId) return;
        itemId = (res as { item?: { id?: string } })?.item?.id ?? null;
        if (!itemId) throw new Error('Could not create draft');
        itemIdRef.current = itemId;
        for (const extra of uploadedIds.slice(1)) {
          try {
            await associateImageToItem(extra, itemId, { skipRefetch: true });
          } catch {
            // non-fatal
          }
        }
      }
      patchStage('draft', { status: 'done' });

      if (asyncCleanupRequested && itemId) {
        patchStage('cleanup', { status: 'active' });
        try {
          if (!cleanupQueuedRef.current) {
            await withTimeout(
              requestCleanup(itemId, uploadedIds),
              PROCESSING_TIMEOUTS_MS.cleanup,
              'Cleanup'
            );
            cleanupQueuedRef.current = true;
          }
          if (runIdRef.current !== runId) return;
          patchStage('cleanup', { status: 'done' });
        } catch (e: any) {
          patchStage('cleanup', {
            status: 'error',
            detail: e?.message || 'Cleanup queue failed',
          });
        }
      } else {
        patchStage('cleanup', { status: 'skipped' });
      }

      patchStage('analyze', { status: 'active' });
      try {
        const data = await withTimeout(
          fetchSuggestions(uploadedIds),
          PROCESSING_TIMEOUTS_MS.analyze,
          'Analyze'
        );
        if (runIdRef.current !== runId) return;
        suggestionsRef.current = data;
        patchStage('analyze', { status: 'done' });
      } catch (e: any) {
        patchStage('analyze', {
          status: 'error',
          detail: e?.message || 'Analyze failed',
        });
      }

      if (runIdRef.current === runId) {
        const payload: ProcessingCompletePayload = {
          imageIds: uploadedIds,
          itemId: itemIdRef.current || '',
          suggestions: suggestionsRef.current,
          cleanupQueued: cleanupQueuedRef.current,
        };
        setTimedOut(false);
        setResult(payload);
        setComplete(true);
      }
    } catch (e: any) {
      if (runIdRef.current !== runId) return;
      setError(e?.message || 'Processing failed');
      setFailed(true);
      setComplete(true);
      setResult({
        imageIds: imageIdsRef.current,
        itemId: itemIdRef.current || '',
        suggestions: suggestionsRef.current,
        cleanupQueued: cleanupQueuedRef.current,
      });
    } finally {
      clearTimeout(overallTimer);
    }
  }, [
    associateImageToItem,
    asyncCleanupRequested,
    createItemFromImage,
    fetchSuggestions,
    merchantHint,
    patchStage,
    requestCleanup,
    uploadFiles,
  ]);

  useEffect(() => {
    void runPipeline();
    return () => {
      runIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = !!result?.itemId && (complete || timedOut);
  const showRetry = failed || (complete && !result?.itemId);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" fontWeight={600}>
          {t(
            'business.onboarding.firstSale.processing.title',
            'Preparing your listing'
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {complete
            ? timedOut
              ? t(
                  'business.onboarding.firstSale.processing.timeoutBody',
                  'Some steps took too long. You can continue and finish details on the next screen.'
                )
              : t(
                  'business.onboarding.firstSale.processing.doneBody',
                  'Ready — review the details we filled in.'
                )
            : t(
                'business.onboarding.firstSale.processing.body',
                'This usually takes a moment. Please keep this screen open.'
              )}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {stages.map((stage) => (
            <Stack key={stage.key} direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ pt: 0.25 }}>
                <StageStatusIcon status={stage.status} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  color={
                    stage.status === 'pending' ? 'text.secondary' : 'text.primary'
                  }
                >
                  {stageLabel(stage.key, t)}
                  {stage.status === 'skipped'
                    ? ` · ${t('common.skipped', 'Skipped')}`
                    : ''}
                  {stage.status === 'done' && stage.key === 'cleanup'
                    ? ` · ${t(
                        'business.onboarding.firstSale.processing.cleanupQueued',
                        'Queued'
                      )}`
                    : ''}
                </Typography>
                {stage.detail ? (
                  <Typography variant="caption" color="error">
                    {stage.detail}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Paper>

      {error && failed ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1}>
        {showRetry ? (
          <Button variant="outlined" onClick={() => void runPipeline()} sx={{ minHeight: 48 }}>
            {t('common.retry', 'Retry')}
          </Button>
        ) : null}
        <Button
          variant="contained"
          disabled={!canContinue}
          onClick={() => {
            if (!result?.itemId) return;
            onContinue(result);
          }}
          sx={{ minHeight: 48 }}
        >
          {timedOut
            ? t(
                'business.onboarding.firstSale.processing.timeoutContinue',
                'Continue anyway'
              )
            : t(
                'business.onboarding.firstSale.processing.continue',
                'Continue to review'
              )}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemProcessingStep;
