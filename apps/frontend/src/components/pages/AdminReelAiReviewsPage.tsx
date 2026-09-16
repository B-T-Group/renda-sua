import {
  Box,
  Button,
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
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import {
  useReelAiReviews,
  type AdminReelAiReviewDetail,
  type ReelAiReviewAuditStatus,
} from '../../hooks/useReelAiReviews';

const AdminReelAiReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const {
    reviews,
    pagination,
    loading,
    error,
    fetchReviews,
    fetchReviewDetail,
    submitFeedback,
    overrideReview,
  } = useReelAiReviews();
  const [status, setStatus] = useState<ReelAiReviewAuditStatus>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminReelAiReviewDetail | null>(null);
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
      setDetail(row);
      setNotes(row.admin_feedback_notes ?? '');
    } catch {
      enqueueSnackbar(
        t('admin.reels.aiReviews.loadError', 'Could not load AI review'),
        { variant: 'error' }
      );
    }
  };

  const onFeedback = async (feedback: 'agree' | 'disagree') => {
    if (!detail) return;
    setBusy(true);
    try {
      await submitFeedback(detail.id, feedback, notes.trim() || undefined);
      enqueueSnackbar(
        t('admin.reels.aiReviews.feedbackSaved', 'Feedback saved'),
        { variant: 'success' }
      );
      setDetail(null);
      reload();
    } catch {
      enqueueSnackbar(
        t('admin.reels.aiReviews.feedbackError', 'Could not save feedback'),
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
      await overrideReview(
        detail.id,
        action,
        action === 'force_reject'
          ? notes.trim() ||
              t(
                'admin.reels.aiReviews.defaultOverrideReject',
                'Admin reversed the AI decision'
              )
          : undefined
      );
      enqueueSnackbar(
        t('admin.reels.aiReviews.overrideSaved', 'Override applied'),
        { variant: 'success' }
      );
      setDetail(null);
      reload();
    } catch {
      enqueueSnackbar(
        t('admin.reels.aiReviews.overrideError', 'Could not apply override'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('admin.accessDenied', 'Access denied')}</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">
          {t('admin.reels.aiReviews.title', 'Reel AI review audit')}
        </Typography>
        <Button component={RouterLink} to="/admin/reels/moderation" variant="outlined">
          {t('admin.reels.aiReviews.backToModeration', 'Reel moderation')}
        </Button>
      </Stack>

      <FormControl size="small" sx={{ mb: 2, minWidth: 180 }}>
        <InputLabel>
          {t('admin.reels.aiReviews.statusFilter', 'Status')}
        </InputLabel>
        <Select
          label={t('admin.reels.aiReviews.statusFilter', 'Status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ReelAiReviewAuditStatus);
            setPage(1);
          }}
        >
          <MenuItem value="all">{t('admin.reels.aiReviews.statusAll', 'All')}</MenuItem>
          <MenuItem value="approved">
            {t('admin.reels.aiReviews.statusApproved', 'Approved')}
          </MenuItem>
          <MenuItem value="deferred">
            {t('admin.reels.aiReviews.statusDeferred', 'Deferred')}
          </MenuItem>
          <MenuItem value="failed">
            {t('admin.reels.aiReviews.statusFailed', 'Failed')}
          </MenuItem>
        </Select>
      </FormControl>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : reviews.length === 0 ? (
        <Typography>
          {t('admin.reels.aiReviews.empty', 'No AI reviews yet')}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.reels.aiReviews.colReel', 'Reel')}</TableCell>
              <TableCell>{t('admin.reels.aiReviews.colStatus', 'Status')}</TableCell>
              <TableCell>{t('admin.reels.aiReviews.colReason', 'Reason')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {reviews.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.reel?.caption || row.reel_id}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>{row.decision_reason}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => void openDetail(row.id)}>
                    {t('admin.reels.aiReviews.open', 'Open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous', 'Previous')}
          </Button>
          <Typography sx={{ alignSelf: 'center' }}>
            {page} / {pagination.totalPages}
          </Typography>
          <Button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next', 'Next')}
          </Button>
        </Stack>
      ) : null}

      <Dialog
        open={!!detail}
        onClose={() => !busy && setDetail(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('admin.reels.aiReviews.detailTitle', 'AI review')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>{detail?.decision_reason}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {detail?.status} · {detail?.prompt_version}
          </Typography>
          {detail?.reel?.video_url ? (
            <Box
              component="video"
              src={detail.reel.video_url}
              controls
              style={{ width: '100%', maxHeight: 280, marginBottom: 16 }}
            />
          ) : null}
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={t('admin.reels.aiReviews.notes', 'Notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button disabled={busy} onClick={() => void onFeedback('agree')}>
            {t('admin.reels.aiReviews.agree', 'Agree')}
          </Button>
          <Button disabled={busy} onClick={() => void onFeedback('disagree')}>
            {t('admin.reels.aiReviews.disagree', 'Disagree')}
          </Button>
          <Button disabled={busy} onClick={() => void onOverride('force_approve')}>
            {t('admin.reels.aiReviews.forceApprove', 'Force approve')}
          </Button>
          <Button disabled={busy} onClick={() => void onOverride('force_reject')}>
            {t('admin.reels.aiReviews.forceReject', 'Force reject')}
          </Button>
          <Button disabled={busy} onClick={() => void onOverride('force_requeue')}>
            {t('admin.reels.aiReviews.requeue', 'Requeue AI')}
          </Button>
          <Button onClick={() => setDetail(null)} disabled={busy}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminReelAiReviewsPage;
