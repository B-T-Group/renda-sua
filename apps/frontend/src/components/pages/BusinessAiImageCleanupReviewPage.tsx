import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAiImageCleanup,
  type AiImageCleanupResult,
} from '../../hooks/useAiImageCleanup';
import SEOHead from '../seo/SEOHead';

const BusinessAiImageCleanupReviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const { getJob, acceptResult, rejectResult, retryResult } = useAiImageCleanup();

  const [results, setResults] = useState<AiImageCleanupResult[]>([]);
  const [itemName, setItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const job = await getJob(jobId);
      if (!job) {
        throw new Error(
          t('business.images.asyncCleanup.jobNotFound', 'Cleanup job not found')
        );
      }
      setItemName(job.item?.name ?? '');
      setResults(job.results ?? []);
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.images.asyncCleanup.loadFailed', 'Failed to load cleanup job'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, getJob, jobId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const snackForAction = (action: 'accept' | 'reject' | 'retry' | 'dismiss') => {
    if (action === 'accept') {
      return t('business.images.asyncCleanup.acceptSuccess', 'Image updated');
    }
    if (action === 'dismiss') {
      return t(
        'business.images.asyncCleanup.dismissSuccess',
        'Removed from review'
      );
    }
    if (action === 'reject') {
      return t('business.images.asyncCleanup.rejectSuccess', 'Kept original');
    }
    return t('business.images.asyncCleanup.retryStarted', 'Retry started');
  };

  const runAction = async (
    resultId: string,
    action: 'accept' | 'reject' | 'retry' | 'dismiss'
  ) => {
    setBusyId(resultId);
    try {
      if (action === 'accept') await acceptResult(resultId);
      else if (action === 'reject' || action === 'dismiss') {
        await rejectResult(resultId);
      } else {
        await retryResult(resultId);
      }
      await load();
      enqueueSnackbar(snackForAction(action), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.images.asyncCleanup.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    } finally {
      setBusyId(null);
    }
  };

  const acceptAllReady = async () => {
    const ready = results.filter((r) => r.status === 'ready');
    for (const r of ready) {
      await runAction(r.id, 'accept');
    }
  };

  const visibleResults = results.filter((r) =>
    isVisibleCleanupResult(r, results)
  );
  const readyCount = visibleResults.filter((r) => r.status === 'ready').length;

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('business.images.asyncCleanup.reviewTitle', 'Review cleaned photos')}
        description={t(
          'business.images.asyncCleanup.hint',
          'We’ll clean your photos in the background after you create the product. You’ll get a notification to review before and after.'
        )}
      />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>

      <Typography variant="h5" fontWeight={600} gutterBottom>
        {t('business.images.asyncCleanup.reviewTitle', 'Review cleaned photos')}
      </Typography>
      {itemName ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {itemName}
        </Typography>
      ) : null}

      {readyCount > 1 ? (
        <Button
          variant="contained"
          onClick={() => void acceptAllReady()}
          disabled={!!busyId}
          sx={{ mb: 2 }}
        >
          {t('business.images.asyncCleanup.acceptAll', 'Accept all ready')}
        </Button>
      ) : null}

      <Stack spacing={2}>
        {visibleResults.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.images.asyncCleanup.emptyReview',
              'Nothing left to review for this cleanup.'
            )}
          </Typography>
        ) : null}
        {visibleResults.map((result) => (
          <Paper key={result.id} variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                mb: 1.5,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('business.images.cleanup.original', 'Original')}
                </Typography>
                <Box
                  component="img"
                  src={result.original_image_url}
                  alt={t('business.images.cleanup.original', 'Original')}
                  sx={{
                    width: '100%',
                    height: 160,
                    objectFit: 'cover',
                    borderRadius: 1,
                    mt: 0.5,
                    bgcolor: 'action.hover',
                  }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('business.images.cleanup.cleaned', 'Cleaned')}
                </Typography>
                {result.cleaned_image_url ? (
                  <Box
                    component="img"
                    src={result.cleaned_image_url}
                    alt={t('business.images.cleanup.cleaned', 'Cleaned')}
                    sx={{
                      width: '100%',
                      height: 160,
                      objectFit: 'cover',
                      borderRadius: 1,
                      mt: 0.5,
                      bgcolor: 'action.hover',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 160,
                      borderRadius: 1,
                      mt: 0.5,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {result.status === 'failed'
                        ? t('business.images.asyncCleanup.failed', 'Failed')
                        : t('business.images.asyncCleanup.processing', 'Processing…')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {result.error_message ? (
              <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                {result.error_message}
              </Typography>
            ) : null}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {result.status}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {result.status === 'ready' ? (
                <>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!!busyId}
                    startIcon={
                      busyId === result.id ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : undefined
                    }
                    onClick={() => void runAction(result.id, 'accept')}
                  >
                    {t('business.images.cleanup.accept', 'Accept and replace')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!!busyId}
                    onClick={() => void runAction(result.id, 'reject')}
                  >
                    {t('business.images.cleanup.reject', 'Reject')}
                  </Button>
                </>
              ) : null}
              {result.status === 'failed' || result.status === 'rejected' ? (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!!busyId}
                    startIcon={
                      busyId === result.id ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : undefined
                    }
                    onClick={() => void runAction(result.id, 'retry')}
                  >
                    {t('business.images.asyncCleanup.retry', 'Retry')}
                  </Button>
                  {result.status === 'failed' ? (
                    <Button
                      color="error"
                      size="small"
                      disabled={!!busyId}
                      onClick={() => void runAction(result.id, 'dismiss')}
                    >
                      {t('business.images.asyncCleanup.dismiss', 'Dismiss')}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Button sx={{ mt: 3 }} onClick={() => navigate('/dashboard')}>
        {t('common.done', 'Done')}
      </Button>
    </Container>
  );
};

function isVisibleCleanupResult(
  result: AiImageCleanupResult,
  all: AiImageCleanupResult[]
): boolean {
  if (result.status === 'accepted') return false;
  if (all.some((r) => r.retry_of_result_id === result.id)) return false;
  if (result.status === 'rejected' && !result.cleaned_image_url) return false;
  return true;
}

export default BusinessAiImageCleanupReviewPage;
