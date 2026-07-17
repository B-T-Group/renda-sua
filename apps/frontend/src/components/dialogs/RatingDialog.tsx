import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating as MuiRating,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import type { OrderRatingEligibility } from '../../hooks/useOrderRatingEligibility';

export type RatingDialogMode = 'agent' | 'item' | 'client';

export interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  mode: RatingDialogMode;
  eligibility: OrderRatingEligibility | null;
  onRatingSubmitted?: () => void;
}

interface RatingEntry {
  rating: number;
  comment: string;
}

interface CreateRatingBody {
  orderId: string;
  ratingType: 'client_to_agent' | 'client_to_item' | 'agent_to_client';
  ratedEntityType: 'agent' | 'client' | 'item';
  ratedEntityId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
}

const emptyEntry: RatingEntry = { rating: 0, comment: '' };

const RatingDialog: React.FC<RatingDialogProps> = ({
  open,
  onClose,
  orderId,
  orderNumber,
  mode,
  eligibility,
  onRatingSubmitted,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [singleEntry, setSingleEntry] = useState<RatingEntry>(emptyEntry);
  const [itemEntries, setItemEntries] = useState<Record<string, RatingEntry>>(
    {}
  );
  // Items saved during this dialog session, so a retry after a partial
  // failure never resubmits (and never double-rates) already-saved items.
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(new Set());

  const unratedItems = (eligibility?.items ?? []).filter(
    (i) => !i.rated && !savedItemIds.has(i.id)
  );

  const titleByMode: Record<RatingDialogMode, string> = {
    agent: t('rating.dialog.rateAgent', 'Rate the Delivery Agent'),
    item: t('rating.dialog.rateItems', 'Rate Your Items'),
    client: t('rating.dialog.rateClient', 'Rate the Client'),
  };

  const buildBodies = (): CreateRatingBody[] => {
    if (mode === 'agent' && eligibility?.agentId && singleEntry.rating > 0) {
      return [
        {
          orderId,
          ratingType: 'client_to_agent',
          ratedEntityType: 'agent',
          ratedEntityId: eligibility.agentId,
          rating: singleEntry.rating,
          comment: singleEntry.comment || undefined,
          isPublic: true,
        },
      ];
    }
    if (mode === 'client' && eligibility?.clientId && singleEntry.rating > 0) {
      return [
        {
          orderId,
          ratingType: 'agent_to_client',
          ratedEntityType: 'client',
          ratedEntityId: eligibility.clientId,
          rating: singleEntry.rating,
          comment: singleEntry.comment || undefined,
          isPublic: true,
        },
      ];
    }
    if (mode === 'item') {
      return unratedItems
        .map((item) => ({ item, entry: itemEntries[item.id] ?? emptyEntry }))
        .filter(({ entry }) => entry.rating > 0)
        .map(({ item, entry }) => ({
          orderId,
          ratingType: 'client_to_item' as const,
          ratedEntityType: 'item' as const,
          ratedEntityId: item.id,
          rating: entry.rating,
          comment: entry.comment || undefined,
          isPublic: true,
        }));
    }
    return [];
  };

  const hasSomethingToSubmit = buildBodies().length > 0;

  const isDuplicateRatingError = (message: string): boolean =>
    /already (rated|exists)|duplicate/i.test(message);

  const submitOne = async (
    body: CreateRatingBody
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const response = await apiClient!.post('/ratings', body);
      if (response.data.success) return { ok: true, message: '' };
      const message = response.data.message || '';
      // An already-saved rating (e.g. from a previous partial submit) counts as done.
      return { ok: isDuplicateRatingError(message), message };
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || '';
      return { ok: isDuplicateRatingError(message), message };
    }
  };

  const handleSubmit = async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);

    // Submit every rating independently: one failure must not abort the rest,
    // and successes are tracked so retries only resend what actually failed.
    const failures: string[] = [];
    for (const body of buildBodies()) {
      const { ok, message } = await submitOne(body);
      if (ok && mode === 'item') {
        setSavedItemIds((prev) => new Set(prev).add(body.ratedEntityId));
      }
      if (!ok) failures.push(message);
    }
    setLoading(false);

    if (failures.length > 0) {
      setError(
        failures[0] || t('rating.dialog.submitError', 'Failed to submit rating')
      );
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      handleReset();
      onClose();
      onRatingSubmitted?.();
    }, 1500);
  };

  const handleReset = () => {
    setSingleEntry(emptyEntry);
    setItemEntries({});
    setSavedItemIds(new Set());
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    // Some ratings may have been saved before a partial failure; let the
    // parent refresh eligibility so the UI reflects them.
    const hadPartialSave = savedItemIds.size > 0;
    handleReset();
    onClose();
    if (hadPartialSave) onRatingSubmitted?.();
  };

  const setItemEntry = (itemId: string, patch: Partial<RatingEntry>) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyEntry), ...patch },
    }));
  };

  const renderStarsAndComment = (
    entry: RatingEntry,
    onChange: (patch: Partial<RatingEntry>) => void,
    commentPlaceholder: string
  ) => (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <MuiRating
          value={entry.rating}
          onChange={(_, value) => onChange({ rating: value || 0 })}
          size="large"
        />
        <Typography variant="body2" color="text.secondary">
          {entry.rating > 0 && `${entry.rating}/5`}
        </Typography>
      </Box>
      <TextField
        fullWidth
        multiline
        rows={3}
        label={t('rating.dialog.comment', 'Comment (optional)')}
        value={entry.comment}
        onChange={(e) => onChange({ comment: e.target.value })}
        placeholder={commentPlaceholder}
      />
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {titleByMode[mode]} — #{orderNumber}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t('rating.dialog.success', 'Rating submitted successfully!')}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {mode === 'agent' &&
            renderStarsAndComment(
              singleEntry,
              (patch) => setSingleEntry((prev) => ({ ...prev, ...patch })),
              t(
                'rating.dialog.agentCommentPlaceholder',
                'Share your experience with the delivery agent...'
              )
            )}

          {mode === 'client' &&
            renderStarsAndComment(
              singleEntry,
              (patch) => setSingleEntry((prev) => ({ ...prev, ...patch })),
              t(
                'rating.dialog.clientCommentPlaceholder',
                'Share your experience with the client...'
              )
            )}

          {mode === 'item' &&
            (unratedItems.length === 0 ? (
              <Alert severity="info">
                {t(
                  'rating.dialog.allItemsRated',
                  'You have already rated all items in this order.'
                )}
              </Alert>
            ) : (
              unratedItems.map((item) => (
                <Box key={item.id}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {item.name}
                  </Typography>
                  {renderStarsAndComment(
                    itemEntries[item.id] ?? emptyEntry,
                    (patch) => setItemEntry(item.id, patch),
                    t(
                      'rating.dialog.itemCommentPlaceholder',
                      'Share your thoughts about the item quality...'
                    )
                  )}
                </Box>
              ))
            ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !hasSomethingToSubmit}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading
            ? t('rating.dialog.submitting', 'Submitting...')
            : t('rating.dialog.submit', 'Submit Rating')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatingDialog;
