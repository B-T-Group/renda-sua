import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useItems,
  type BusinessItemAiProposalPayload,
} from '../../hooks/useItems';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const BusinessItemAiProposalPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const {
    fetchItemAiProposal,
    acceptItemAiProposal,
    declineItemAiProposal,
  } = useItems(businessId, { skipInitialItemsFetch: true });

  const [data, setData] = useState<BusinessItemAiProposalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [applyTitle, setApplyTitle] = useState(false);
  const [applyDescription, setApplyDescription] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setTitle('');
    setDescription('');

    void (async () => {
      try {
        const res = await fetchItemAiProposal(itemId);
        if (cancelled) return;
        setData(res);
        setTitle(res.proposal?.proposed_title ?? res.item?.name ?? '');
        setDescription(
          res.proposal?.proposed_description ?? res.item?.description ?? ''
        );
        setApplyTitle(!!res.proposal?.proposed_title);
        setApplyDescription(!!res.proposal?.proposed_description);
      } catch (e: any) {
        if (cancelled) return;
        enqueueSnackbar(
          e?.message ||
            t(
              'business.items.aiProposal.loadFailed',
              'Could not load proposal'
            ),
          { variant: 'error' }
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enqueueSnackbar, fetchItemAiProposal, itemId, t]);

  const goBackToItem = () => {
    if (itemId) {
      navigate(`/business/items/${itemId}`);
      return;
    }
    navigate('/business/items');
  };

  const onAccept = async (asIs: boolean) => {
    if (!itemId || data?.item?.id !== itemId) return;
    setBusy(true);
    try {
      const edits = asIs
        ? { applyTitle: false, applyDescription: false }
        : {
            applyTitle,
            applyDescription,
            ...(applyTitle ? { title: title.trim() } : {}),
            ...(applyDescription ? { description: description.trim() } : {}),
          };
      const ok = await acceptItemAiProposal(itemId, edits);
      if (!ok) throw new Error('Accept failed');
      enqueueSnackbar(
        asIs
          ? t(
              'business.items.aiProposal.publishAsIsSuccess',
              'Published without changes'
            )
          : t('business.items.aiProposal.acceptSuccess', 'Proposal accepted'),
        { variant: 'success' }
      );
      goBackToItem();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.items.aiProposal.acceptFailed',
            'Could not accept proposal'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    if (!itemId || data?.item?.id !== itemId) return;
    setBusy(true);
    try {
      const ok = await declineItemAiProposal(itemId);
      if (!ok) throw new Error('Decline failed');
      enqueueSnackbar(
        t(
          'business.items.aiProposal.declineSuccess',
          'Proposal declined; re-reviewing'
        ),
        { variant: 'success' }
      );
      goBackToItem();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.items.aiProposal.declineFailed',
            'Could not decline proposal'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <LoadingPage message={t('common.loading', 'Loading...')} showProgress />
    );
  }

  const original = data?.item;
  const proposal = data?.proposal;
  const canAct =
    !!itemId &&
    data?.item?.id === itemId &&
    data.item.moderation_status === 'proposal_pending' &&
    !!proposal;

  return (
    <>
      <SEOHead
        title={t('business.items.aiProposal.title', 'Review AI suggestions')}
      />
      <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={goBackToItem}
          sx={{ mb: 2 }}
        >
          {t('common.back', 'Back')}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t('business.items.aiProposal.title', 'Review AI suggestions')}
        </Typography>
        {proposal?.decision_reason ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {proposal.decision_reason}
          </Typography>
        ) : null}

        {!canAct ? (
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">
              {t(
                'business.items.aiProposal.notAvailable',
                'No AI proposal is waiting for this item.'
              )}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('business.items.aiProposal.currentTitle', 'Current title')}
              </Typography>
              <Typography sx={{ mb: 1 }}>{original?.name}</Typography>
              {proposal?.proposed_title ? (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={applyTitle}
                        onChange={(e) => setApplyTitle(e.target.checked)}
                        disabled={busy}
                      />
                    }
                    label={t(
                      'business.items.aiProposal.applyTitle',
                      'Use AI suggested title'
                    )}
                  />
                  <TextField
                    fullWidth
                    sx={{ mt: 1 }}
                    label={t(
                      'business.items.aiProposal.suggestedTitle',
                      'Suggested title'
                    )}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy || !applyTitle}
                  />
                </>
              ) : null}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 2 }}
              >
                {t(
                  'business.items.aiProposal.currentDescription',
                  'Current description'
                )}
              </Typography>
              <Typography sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                {original?.description || '—'}
              </Typography>
              {proposal?.proposed_description ? (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={applyDescription}
                        onChange={(e) => setApplyDescription(e.target.checked)}
                        disabled={busy}
                      />
                    }
                    label={t(
                      'business.items.aiProposal.applyDescription',
                      'Use AI suggested description'
                    )}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    sx={{ mt: 1 }}
                    label={t(
                      'business.items.aiProposal.suggestedDescription',
                      'Suggested description'
                    )}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={busy || !applyDescription}
                  />
                </>
              ) : null}
            </Paper>

            <Alert severity="info">
              {t(
                'business.items.aiProposal.cleanupHint',
                "Want cleaner photos? You can run AI photo cleanup (uses AI tokens) anytime from the item's Images tab — it never runs automatically."
              )}
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                disabled={busy || (!applyTitle && !applyDescription)}
                onClick={() => void onAccept(false)}
                startIcon={busy ? <CircularProgress size={16} /> : undefined}
              >
                {t(
                  'business.items.aiProposal.applySelected',
                  'Apply selected & publish'
                )}
              </Button>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => void onAccept(true)}
              >
                {t(
                  'business.items.aiProposal.publishAsIs',
                  'Publish without changes'
                )}
              </Button>
              <Button
                variant="text"
                color="inherit"
                disabled={busy}
                onClick={() => void onDecline()}
              >
                {t(
                  'business.items.aiProposal.decline',
                  'Decline & resubmit for AI review'
                )}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t(
                'business.items.aiProposal.actionsHint',
                '"Publish without changes" publishes the item exactly as you wrote it. Declining sends it back for another AI review.'
              )}
            </Typography>
          </Stack>
        )}
      </Box>
    </>
  );
};

export default BusinessItemAiProposalPage;
