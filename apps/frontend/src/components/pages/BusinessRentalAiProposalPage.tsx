import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useRentalApi,
  type BusinessAiProposalPayload,
} from '../../hooks/useRentalApi';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const BusinessRentalAiProposalPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { listingId } = useParams<{ listingId: string }>();
  const {
    fetchBusinessAiProposal,
    acceptBusinessAiProposal,
    declineBusinessAiProposal,
  } = useRentalApi();

  const [data, setData] = useState<BusinessAiProposalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setTitle('');
    setDescription('');

    void (async () => {
      try {
        const res = await fetchBusinessAiProposal(listingId);
        if (cancelled) return;
        setData(res);
        setTitle(
          res.proposal?.proposed_title ?? res.listing?.rental_item.name ?? ''
        );
        setDescription(
          res.proposal?.proposed_description ??
            res.listing?.rental_item.description ??
            ''
        );
      } catch (e: any) {
        if (cancelled) return;
        enqueueSnackbar(
          e?.message ||
            t(
              'business.rentals.aiProposal.loadFailed',
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
  }, [enqueueSnackbar, fetchBusinessAiProposal, listingId, t]);

  const goBackToItem = () => {
    const itemId = data?.listing?.rental_item.id;
    if (itemId) {
      navigate(`/business/rentals/items/${itemId}`);
      return;
    }
    navigate('/business/rentals/catalog');
  };

  const onAccept = async () => {
    if (!listingId || data?.listing?.id !== listingId) return;
    setBusy(true);
    try {
      const ok = await acceptBusinessAiProposal(listingId, {
        title: title.trim(),
        description: description.trim(),
      });
      if (!ok) throw new Error('Accept failed');
      enqueueSnackbar(
        t('business.rentals.aiProposal.acceptSuccess', 'Proposal accepted'),
        { variant: 'success' }
      );
      goBackToItem();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t('business.rentals.aiProposal.acceptFailed', 'Could not accept proposal'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    if (!listingId || data?.listing?.id !== listingId) return;
    setBusy(true);
    try {
      const ok = await declineBusinessAiProposal(listingId);
      if (!ok) throw new Error('Decline failed');
      enqueueSnackbar(
        t(
          'business.rentals.aiProposal.declineSuccess',
          'Proposal declined; re-reviewing'
        ),
        { variant: 'success' }
      );
      goBackToItem();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.rentals.aiProposal.declineFailed',
            'Could not decline proposal'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  const original = data?.listing?.rental_item;
  const proposal = data?.proposal;
  const canAct =
    !!listingId &&
    data?.listing?.id === listingId &&
    data.listing.moderation_status === 'proposal_pending' &&
    !!proposal;

  return (
    <>
      <SEOHead
        title={t('business.rentals.aiProposal.title', 'Review AI suggestions')}
      />
      <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={goBackToItem} sx={{ mb: 2 }}>
          {t('common.back', 'Back')}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t('business.rentals.aiProposal.title', 'Review AI suggestions')}
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
                'business.rentals.aiProposal.notAvailable',
                'No AI proposal is waiting for this listing.'
              )}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('business.rentals.aiProposal.currentTitle', 'Current title')}
              </Typography>
              <Typography sx={{ mb: 2 }}>{original?.name}</Typography>
              <TextField
                fullWidth
                label={t(
                  'business.rentals.aiProposal.suggestedTitle',
                  'Suggested title'
                )}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 2 }}
              >
                {t(
                  'business.rentals.aiProposal.currentDescription',
                  'Current description'
                )}
              </Typography>
              <Typography sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {original?.description || '—'}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label={t(
                  'business.rentals.aiProposal.suggestedDescription',
                  'Suggested description'
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </Paper>

            {(proposal?.proposed_images?.length ?? 0) > 0 ? (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t(
                    'business.rentals.aiProposal.cleanedImages',
                    'Suggested cleaned images'
                  )}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {proposal?.proposed_images?.map((img) => (
                    <Box
                      key={img.id}
                      component="img"
                      src={img.image_url}
                      alt=""
                      sx={{
                        width: 120,
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                      }}
                    />
                  ))}
                </Stack>
              </Paper>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() => void onAccept()}
                startIcon={busy ? <CircularProgress size={16} /> : undefined}
              >
                {t('business.rentals.aiProposal.accept', 'Accept & publish')}
              </Button>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => void onDecline()}
              >
                {t('business.rentals.aiProposal.decline', 'Decline & resubmit')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </>
  );
};

export default BusinessRentalAiProposalPage;
