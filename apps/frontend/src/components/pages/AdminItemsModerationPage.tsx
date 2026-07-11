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
import { Link as RouterLink } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useItemModeration,
  type ItemModerationQueueStatus,
} from '../../hooks/useItemModeration';
import ItemModerationStatusChip from '../business/ItemModerationStatusChip';

const AdminItemsModerationPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const isAdmin =
    profile?.user_type_id === 'business' && profile?.business?.is_admin;
  const {
    items,
    pagination,
    loading,
    error,
    fetchQueue,
    approveItem,
    rejectItem,
  } = useItemModeration();
  const [status, setStatus] = useState<ItemModerationQueueStatus>('pending');
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const reload = useCallback(() => {
    void fetchQueue(status, page, 20);
  }, [fetchQueue, status, page]);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  const onApprove = async (id: string) => {
    setActionBusy(true);
    try {
      const ok = await approveItem(id);
      if (ok) reload();
    } finally {
      setActionBusy(false);
    }
  };

  const onConfirmReject = async () => {
    if (!rejectId || !rejectNote.trim()) return;
    setActionBusy(true);
    try {
      const ok = await rejectItem(rejectId, rejectNote.trim());
      if (ok) {
        setRejectId(null);
        setRejectNote('');
        reload();
      }
    } finally {
      setActionBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error" variant="h6">
          {t('admin.itemModeration.accessDenied', 'Access denied')}
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
          {t('admin.itemModeration.pageTitle', 'Sale item moderation')}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>
            {t('admin.itemModeration.statusFilter', 'Queue')}
          </InputLabel>
          <Select
            label={t('admin.itemModeration.statusFilter', 'Queue')}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ItemModerationQueueStatus);
            }}
          >
            <MenuItem value="pending">
              {t('admin.itemModeration.pending', 'Pending')}
            </MenuItem>
            <MenuItem value="ai_reviewing">
              {t('admin.itemModeration.aiReviewing', 'AI reviewing')}
            </MenuItem>
            <MenuItem value="proposal_pending">
              {t('admin.itemModeration.proposalPending', 'AI proposal pending')}
            </MenuItem>
            <MenuItem value="rejected">
              {t('admin.itemModeration.rejected', 'Rejected')}
            </MenuItem>
            <MenuItem value="all">
              {t(
                'admin.itemModeration.all',
                'Pending, AI reviewing, proposals, and rejected'
              )}
            </MenuItem>
          </Select>
        </FormControl>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => reload()}
          disabled={loading}
        >
          {t('admin.itemModeration.refresh', 'Refresh')}
        </Button>
        <Button
          component={RouterLink}
          to="/admin/items/ai-reviews"
          variant="text"
        >
          {t('admin.itemModeration.aiReviewsLink', 'AI review audit')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'admin.itemModeration.pageSubtitle',
          'Approve or reject new sale items before they appear in the public catalog.'
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
              {t('admin.itemModeration.loadError', 'Could not load moderation queue')}
              : {error}
            </Typography>
          )}
          {!loading && !error && items.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              {t('admin.itemModeration.empty', 'No items in this queue')}
            </Typography>
          )}
          {!loading && items.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.itemModeration.itemName', 'Sale item')}
                  </TableCell>
                  <TableCell>
                    {t('admin.itemModeration.business', 'Business')}
                  </TableCell>
                  <TableCell>
                    {t('admin.itemModeration.status', 'Status')}
                  </TableCell>
                  <TableCell align="right">
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.business.name}</TableCell>
                    <TableCell>
                      <ItemModerationStatusChip status={row.moderation_status} />
                    </TableCell>
                    <TableCell align="right">
                      {row.moderation_status === 'pending' ||
                      row.moderation_status === 'ai_reviewing' ? (
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={actionBusy}
                            onClick={() => void onApprove(row.id)}
                          >
                            {t('admin.itemModeration.approve', 'Approve')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={actionBusy}
                            onClick={() => {
                              setRejectId(row.id);
                              setRejectNote('');
                            }}
                          >
                            {t('admin.itemModeration.reject', 'Reject')}
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {row.moderation_status === 'proposal_pending'
                            ? t(
                                'admin.itemModeration.awaitingBusiness',
                                'Awaiting business'
                              )
                            : '—'}
                        </Typography>
                      )}
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
        open={!!rejectId}
        onClose={() => !actionBusy && setRejectId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.itemModeration.rejectTitle', 'Reject item')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'admin.itemModeration.rejectHelp',
              'The business will see this reason in their messages and by email.'
            )}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t('admin.itemModeration.rejectionReason', 'Rejection reason')}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            disabled={actionBusy}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectId(null)} disabled={actionBusy}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectNote.trim() || actionBusy}
            onClick={() => void onConfirmReject()}
          >
            {t('admin.itemModeration.reject', 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminItemsModerationPage;
