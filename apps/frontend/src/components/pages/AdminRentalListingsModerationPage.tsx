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
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalListingModeration,
  type RentalModerationQueueStatus,
} from '../../hooks/useRentalListingModeration';
import RentalListingModerationStatusChip from '../rentals/RentalListingModerationStatusChip';

const AdminRentalListingsModerationPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const isAdmin =
    profile?.user_type_id === 'business' && profile?.business?.is_admin;
  const {
    listings,
    pagination,
    loading,
    error,
    fetchQueue,
    approveListing,
    rejectListing,
  } = useRentalListingModeration();
  const [status, setStatus] = useState<RentalModerationQueueStatus>('pending');
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
      const ok = await approveListing(id);
      if (ok) reload();
    } finally {
      setActionBusy(false);
    }
  };

  const onConfirmReject = async () => {
    if (!rejectId || !rejectNote.trim()) return;
    setActionBusy(true);
    try {
      const ok = await rejectListing(rejectId, rejectNote.trim());
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
          {t('admin.rentalListingModeration.accessDenied', 'Access denied')}
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
          {t('admin.rentalListingModeration.pageTitle', 'Rental listing moderation')}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t('admin.rentalListingModeration.statusFilter', 'Queue')}</InputLabel>
          <Select
            label={t('admin.rentalListingModeration.statusFilter', 'Queue')}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as RentalModerationQueueStatus);
            }}
          >
            <MenuItem value="pending">
              {t('admin.rentalListingModeration.pending', 'Pending')}
            </MenuItem>
            <MenuItem value="rejected">
              {t('admin.rentalListingModeration.rejected', 'Rejected')}
            </MenuItem>
            <MenuItem value="all">
              {t('admin.rentalListingModeration.all', 'Pending and rejected')}
            </MenuItem>
          </Select>
        </FormControl>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => reload()}
          disabled={loading}
        >
          {t('admin.rentalListingModeration.refresh', 'Refresh')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'admin.rentalListingModeration.pageSubtitle',
          'Approve or reject new rental listings before they appear in the public catalog.'
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
              {t('admin.rentalListingModeration.loadError', 'Could not load moderation queue')}:{' '}
              {error}
            </Typography>
          )}
          {!loading && !error && listings.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              {t('admin.rentalListingModeration.empty', 'No listings in this queue')}
            </Typography>
          )}
          {!loading && listings.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.rentalListingModeration.itemName', 'Rental item')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalListingModeration.business', 'Business')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalListingModeration.location', 'Location')}
                  </TableCell>
                  <TableCell>
                    {t('admin.rentalListingModeration.status', 'Status')}
                  </TableCell>
                  <TableCell align="right">
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.rental_item.name}</TableCell>
                    <TableCell>{row.rental_item.business.name}</TableCell>
                    <TableCell>{row.business_location.name}</TableCell>
                    <TableCell>
                      <RentalListingModerationStatusChip
                        status={row.moderation_status}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {row.moderation_status === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={actionBusy}
                            onClick={() => void onApprove(row.id)}
                          >
                            {t('admin.rentalListingModeration.approve', 'Approve')}
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
                            {t('admin.rentalListingModeration.reject', 'Reject')}
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
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
          {t('admin.rentalListingModeration.rejectTitle', 'Reject listing')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'admin.rentalListingModeration.rejectHelp',
              'The business will see this reason in their messages and by email.'
            )}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t('admin.rentalListingModeration.rejectionReason', 'Rejection reason')}
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
            {t('admin.rentalListingModeration.reject', 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminRentalListingsModerationPage;
