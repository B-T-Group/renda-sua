import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Link as RouterLink } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalListingAiReviews,
  type AdminAiReviewDetail,
  type AiReviewAuditStatus,
} from '../../hooks/useRentalListingAiReviews';
import RentalListingModerationStatusChip from '../rentals/RentalListingModerationStatusChip';

function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = err?.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && m.length) return String(m[0]);
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const AdminRentalAiReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const isAdmin =
    profile?.user_type_id === 'business' && profile?.business?.is_admin;
  const {
    reviews,
    pagination,
    loading,
    error,
    fetchReviews,
    fetchReviewDetail,
    submitFeedback,
    overrideReview,
  } = useRentalListingAiReviews();

  const [status, setStatus] = useState<AiReviewAuditStatus>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminAiReviewDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    void fetchReviews(status, page, 20);
  }, [fetchReviews, status, page]);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  const openDetail = async (id: string) => {
    try {
      const row = await fetchReviewDetail(id);
      if (!row) {
        enqueueSnackbar(
          t('admin.rentalAiReviews.loadError', 'Could not load AI reviews'),
          { variant: 'error' }
        );
        return;
      }
      setDetail(row);
      setNotes(row.admin_feedback_notes ?? '');
    } catch (e: unknown) {
      enqueueSnackbar(
        apiErrorMessage(
          e,
          t('admin.rentalAiReviews.loadError', 'Could not load AI reviews')
        ),
        { variant: 'error' }
      );
    }
  };

  const onFeedback = async (feedback: 'agree' | 'disagree') => {
    if (!detail) return;
    setBusy(true);
    try {
      const ok = await submitFeedback(
        detail.id,
        feedback,
        notes.trim() || undefined
      );
      if (!ok) {
        throw new Error(
          t('admin.rentalAiReviews.actionFailed', 'Action failed')
        );
      }
      enqueueSnackbar(
        t('admin.rentalAiReviews.feedbackSaved', 'Feedback saved'),
        { variant: 'success' }
      );
      setDetail(null);
      reload();
    } catch (e: unknown) {
      enqueueSnackbar(
        apiErrorMessage(
          e,
          t('admin.rentalAiReviews.actionFailed', 'Action failed')
        ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const onOverride = async (
    action: 'force_approve' | 'force_reject' | 'force_requeue'
  ) => {
    if (!detail) return;
    setBusy(true);
    try {
      const ok = await overrideReview(
        detail.id,
        action,
        notes.trim() || undefined
      );
      if (!ok) {
        throw new Error(
          t('admin.rentalAiReviews.actionFailed', 'Action failed')
        );
      }
      enqueueSnackbar(
        t('admin.rentalAiReviews.overrideSaved', 'Override applied'),
        { variant: 'success' }
      );
      setDetail(null);
      reload();
    } catch (e: unknown) {
      enqueueSnackbar(
        apiErrorMessage(
          e,
          t('admin.rentalAiReviews.actionFailed', 'Action failed')
        ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error" variant="h6">
          {t('admin.rentalAiReviews.accessDenied', 'Access denied')}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ flex: 1, minWidth: 200 }}>
          {t('admin.rentalAiReviews.pageTitle', 'AI review decisions')}
        </Typography>
        <Button
          component={RouterLink}
          to="/admin/rental-listings/moderation"
          variant="text"
        >
          {t('admin.rentalAiReviews.backToModeration', 'Listing moderation')}
        </Button>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>
            {t('admin.rentalAiReviews.statusFilter', 'Status')}
          </InputLabel>
          <Select
            label={t('admin.rentalAiReviews.statusFilter', 'Status')}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AiReviewAuditStatus);
            }}
          >
            <MenuItem value="all">
              {t('admin.rentalAiReviews.filterAll', 'All')}
            </MenuItem>
            <MenuItem value="approved">
              {t('admin.rentalAiReviews.filterApproved', 'Approved')}
            </MenuItem>
            <MenuItem value="rejected">
              {t('admin.rentalAiReviews.filterRejected', 'Rejected')}
            </MenuItem>
            <MenuItem value="proposal">
              {t('admin.rentalAiReviews.filterProposal', 'Proposals')}
            </MenuItem>
            <MenuItem value="failed">
              {t('admin.rentalAiReviews.filterFailed', 'Failed')}
            </MenuItem>
          </Select>
        </FormControl>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => reload()}
          disabled={loading}
        >
          {t('admin.rentalAiReviews.refresh', 'Refresh')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'admin.rentalAiReviews.pageSubtitle',
          'Audit AI auto-review decisions for prompt tuning and overrides.'
        )}
      </Typography>

      <Card>
        <CardContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {error && (
            <Typography color="error" sx={{ py: 2 }}>
              {t('admin.rentalAiReviews.loadError', 'Could not load AI reviews')}:{' '}
              {error}
            </Typography>
          )}
          {!loading && !error && reviews.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              {t('admin.rentalAiReviews.empty', 'No AI reviews yet.')}
            </Typography>
          )}
          {!loading && reviews.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.rentalAiReviews.itemName', 'Rental item')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalAiReviews.business', 'Business')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalAiReviews.decision', 'AI decision')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalAiReviews.listingStatus', 'Listing status')}
                  </TableCell>
                  <TableCell align="right">
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviews.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.listing?.rental_item?.name ?? row.listing_id}
                    </TableCell>
                    <TableCell>
                      {row.listing?.rental_item?.business?.name ?? '—'}
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      <RentalListingModerationStatusChip
                        status={row.listing?.moderation_status}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => void openDetail(row.id)}>
                        {t('admin.rentalAiReviews.view', 'View')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
              <Button
                size="small"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous', { defaultValue: 'Previous' })}
              </Button>
              <Typography variant="body2">
                {pagination.page} / {pagination.totalPages}
              </Typography>
              <Button
                size="small"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', { defaultValue: 'Next' })}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!detail}
        onClose={() => !busy && setDetail(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t('admin.rentalAiReviews.detailTitle', 'AI review detail')}
        </DialogTitle>
        <DialogContent>
          {detail ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body2">
                <strong>{t('admin.rentalAiReviews.decision', 'AI decision')}:</strong>{' '}
                {detail.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {detail.decision_reason || '—'}
              </Typography>
              {detail.proposed_title ? (
                <Typography variant="body2">
                  <strong>
                    {t('admin.rentalAiReviews.proposedTitle', 'Proposed title')}:
                  </strong>{' '}
                  {detail.proposed_title}
                </Typography>
              ) : null}
              {detail.proposed_description ? (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  <strong>
                    {t(
                      'admin.rentalAiReviews.proposedDescription',
                      'Proposed description'
                    )}
                    :
                  </strong>{' '}
                  {detail.proposed_description}
                </Typography>
              ) : null}
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t('admin.rentalAiReviews.notes', 'Notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setDetail(null)} disabled={busy}>
            {t('common.close', 'Close')}
          </Button>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => void onFeedback('agree')}
          >
            {t('admin.rentalAiReviews.agree', 'Agree')}
          </Button>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => void onFeedback('disagree')}
          >
            {t('admin.rentalAiReviews.disagree', 'Disagree')}
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy}
            onClick={() => void onOverride('force_approve')}
          >
            {t('admin.rentalAiReviews.forceApprove', 'Force approve')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy}
            onClick={() => void onOverride('force_reject')}
          >
            {t('admin.rentalAiReviews.forceReject', 'Force reject')}
          </Button>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => void onOverride('force_requeue')}
          >
            {t('admin.rentalAiReviews.forceRequeue', 'Requeue AI')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminRentalAiReviewsPage;
