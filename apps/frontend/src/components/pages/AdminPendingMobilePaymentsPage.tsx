import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  type PendingMobilePaymentRow,
  type ProviderStatusResponse,
  useAdminMobilePaymentProviderStatus,
  useAdminPendingMobilePayments,
  useResolvePendingMobilePayment,
} from '../../hooks/useAdminPendingMobilePaymentsApi';
import { formatPendingDuration } from '../../utils/pendingPaymentDuration';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const AdminPendingMobilePaymentsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfileContext();
  const {
    items,
    loading,
    error,
    refetch,
    offset,
    setOffset,
    limit,
    hasMore,
  } = useAdminPendingMobilePayments();
  const fetchProviderStatus = useAdminMobilePaymentProviderStatus();
  const resolvePayment = useResolvePendingMobilePayment();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRow, setDialogRow] = useState<PendingMobilePaymentRow | null>(
    null
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusPayload, setStatusPayload] =
    useState<ProviderStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const openStatusDialog = useCallback(
    async (row: PendingMobilePaymentRow) => {
      setDialogRow(row);
      setDialogOpen(true);
      setStatusPayload(null);
      setStatusError(null);
      setStatusLoading(true);
      try {
        const data = await fetchProviderStatus(row.id);
        setStatusPayload(data);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error)?.message || 'Request failed';
        setStatusError(msg);
      } finally {
        setStatusLoading(false);
      }
    },
    [fetchProviderStatus]
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogRow(null);
    setStatusPayload(null);
    setStatusError(null);
  }, []);

  const onResolve = useCallback(
    async (row: PendingMobilePaymentRow) => {
      setResolvingId(row.id);
      try {
        const res = await resolvePayment(row.id);
        if (res.replayed) {
          enqueueSnackbar(
            t(
              'admin.pendingMobilePayments.resolveReplayed',
              'Transaction finalized from provider status.'
            ),
            { variant: 'success' }
          );
        } else {
          enqueueSnackbar(
            res.message ||
              t(
                'admin.pendingMobilePayments.resolveNoReplay',
                'No replay: provider still pending or already finalized.'
              ),
            { variant: 'info' }
          );
        }
        await refetch();
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error)?.message || 'Request failed';
        enqueueSnackbar(msg, { variant: 'error' });
      } finally {
        setResolvingId(null);
      }
    },
    [enqueueSnackbar, refetch, resolvePayment, t]
  );

  if (profileLoading) {
    return <LoadingScreen />;
  }

  if (profileError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t('common.error', 'Error')}: {profileError}
        </Typography>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t(
            'admin.pendingMobilePayments.noBusinessProfile',
            'Business profile not found'
          )}
        </Typography>
      </Container>
    );
  }

  if (!profile.business.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t(
            'admin.pendingMobilePayments.unauthorized',
            'You are not authorized to access this page'
          )}
        </Typography>
      </Container>
    );
  }

  const disableActions = (row: PendingMobilePaymentRow) =>
    !row.transaction_id?.trim();

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t(
          'admin.pendingMobilePayments.pageTitle',
          'Pending mobile payments'
        )}
        description={t(
          'admin.pendingMobilePayments.pageDescription',
          'Review stuck MyPVit and Freemopay transactions and replay callbacks when the provider reports a final status.'
        )}
        keywords={t(
          'admin.pendingMobilePayments.pageKeywords',
          'admin, mobile money, payments, reconciliation'
        )}
      />

      <Typography variant="h4" component="h1" gutterBottom>
        {t(
          'admin.pendingMobilePayments.pageTitle',
          'Pending mobile payments'
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'admin.pendingMobilePayments.pageDescription',
          'Review stuck MyPVit and Freemopay transactions and replay callbacks when the provider reports a final status.'
        )}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                {t('admin.pendingMobilePayments.reference', 'Reference')}
              </TableCell>
              <TableCell align="right">
                {t('admin.pendingMobilePayments.amount', 'Amount')}
              </TableCell>
              <TableCell>
                {t('admin.pendingMobilePayments.currency', 'Currency')}
              </TableCell>
              <TableCell>
                {t('admin.pendingMobilePayments.description', 'Description')}
              </TableCell>
              <TableCell>
                {t('admin.pendingMobilePayments.createdAt', 'Created')}
              </TableCell>
              <TableCell>
                {t(
                  'admin.pendingMobilePayments.pendingFor',
                  'Pending for'
                )}
              </TableCell>
              <TableCell>
                {t(
                  'admin.pendingMobilePayments.customerPhone',
                  'Customer phone'
                )}
              </TableCell>
              <TableCell align="right">
                {t('admin.pendingMobilePayments.actions', 'Actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  {t(
                    'admin.pendingMobilePayments.empty',
                    'No pending integration payments.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.reference}</TableCell>
                  <TableCell align="right">{Number(row.amount)}</TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{row.description}</TableCell>
                  <TableCell>
                    {new Date(row.created_at).toLocaleString(i18n.language)}
                  </TableCell>
                  <TableCell>
                    {formatPendingDuration(
                      row.created_at,
                      nowMs,
                      i18n.language
                    )}
                  </TableCell>
                  <TableCell>{row.customer_phone ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Tooltip
                        title={
                          disableActions(row)
                            ? t(
                                'admin.pendingMobilePayments.missingProviderId',
                                'Provider transaction id is missing'
                              )
                            : ''
                        }
                      >
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={disableActions(row)}
                            onClick={() => void openStatusDialog(row)}
                          >
                            {t(
                              'admin.pendingMobilePayments.viewStatus',
                              'View status'
                            )}
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          disableActions(row)
                            ? t(
                                'admin.pendingMobilePayments.missingProviderId',
                                'Provider transaction id is missing'
                              )
                            : ''
                        }
                      >
                        <span>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={
                              disableActions(row) || resolvingId === row.id
                            }
                            onClick={() => void onResolve(row)}
                          >
                            {resolvingId === row.id ? (
                              <CircularProgress size={18} color="inherit" />
                            ) : (
                              t('admin.pendingMobilePayments.resolve', 'Resolve')
                            )}
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button
          disabled={offset === 0 || loading}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
        >
          {t('common.previous', 'Previous')}
        </Button>
        <Button
          disabled={!hasMore || loading}
          onClick={() => setOffset((o) => o + limit)}
        >
          {t('common.next', 'Next')}
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t(
            'admin.pendingMobilePayments.statusDialogTitle',
            'Provider status'
          )}
          {dialogRow ? ` · ${dialogRow.reference}` : ''}
        </DialogTitle>
        <DialogContent>
          {statusLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {statusError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {statusError}
            </Alert>
          )}
          {statusPayload?.data && !statusLoading && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2">
                <strong>
                  {t('admin.pendingMobilePayments.dbStatus', 'DB status')}:
                </strong>{' '}
                {statusPayload.data.dbStatus}
              </Typography>
              <Typography variant="body2">
                <strong>
                  {t('admin.pendingMobilePayments.dbReference', 'DB reference')}:
                </strong>{' '}
                {statusPayload.data.dbReference}
              </Typography>
              <Typography variant="body2">
                <strong>
                  {t('admin.pendingMobilePayments.provider', 'Provider')}:
                </strong>{' '}
                {statusPayload.data.provider}
              </Typography>
              <Typography variant="body2">
                <strong>
                  {t(
                    'admin.pendingMobilePayments.liveStatus',
                    'Live status'
                  )}
                  :
                </strong>{' '}
                {t(
                  `admin.pendingMobilePayments.liveStatusLabels.${statusPayload.data.providerStatus.status}`,
                  statusPayload.data.providerStatus.status
                )}
              </Typography>
              <Typography variant="body2">
                <strong>
                  {t('admin.pendingMobilePayments.amount', 'Amount')}:
                </strong>{' '}
                {statusPayload.data.providerStatus.amount}{' '}
                {statusPayload.data.providerStatus.currency}
              </Typography>
              {statusPayload.data.providerStatus.message && (
                <Typography variant="body2">
                  <strong>
                    {t('admin.pendingMobilePayments.message', 'Message')}:
                  </strong>{' '}
                  {statusPayload.data.providerStatus.message}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminPendingMobilePaymentsPage;
