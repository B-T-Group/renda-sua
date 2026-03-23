import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import {
  useRentalApi,
  type ClientRentalRequestRow,
} from '../../hooks/useRentalApi';
import ConfirmationModal from '../common/ConfirmationModal';
import LoadingPage from '../common/LoadingPage';
import { RentalBookConfirmSummary } from '../rentals/RentalBookConfirmSummary';
import {
  ClientRentalRequestRowCard,
  isProposedContractOpen,
} from '../rentals/ClientRentalRequestRowCard';
import SEOHead from '../seo/SEOHead';

function apiErrorMessage(err: unknown, fallback: string): string {
  const m = (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

function rentalBookingErrorIsExpired(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 410 || /expired/i.test(apiErrorMessage(err, ''));
}

const RENTAL_REQUEST_STATUSES = [
  'pending',
  'available',
  'unavailable',
  'booked',
  'expired',
  'cancelled',
] as const;

type RentalRequestStatusValue = (typeof RENTAL_REQUEST_STATUSES)[number];

const statusFilterFormSx = {
  width: '100%',
  minWidth: { xs: 0, sm: 240 },
  maxWidth: '100%',
} as const;

const ClientRentalRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated } = useAuth0();
  const { createBooking, cancelClientRentalRequest, fetchClientRentalRequests } =
    useRentalApi();
  const [rows, setRows] = useState<ClientRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [bookConfirmRequestId, setBookConfirmRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RentalRequestStatusValue | ''>('');

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchClientRentalRequests();
      setRows(list);
    } catch (e: unknown) {
      setRows([]);
      setError(
        apiErrorMessage(
          e,
          t('rentals.loadRequestsError', 'Could not load requests')
        )
      );
    } finally {
      setLoading(false);
    }
  }, [fetchClientRentalRequests, t]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const openBookConfirm = (requestId: string) => {
    const row = rows.find((r) => r.id === requestId);
    if (!row || row.status !== 'available' || !isProposedContractOpen(row)) {
      enqueueSnackbar(
        t(
          'rentals.clientRequests.contractExpiredBookError',
          'This offer has expired. Send a new request from the listing.'
        ),
        { variant: 'error' }
      );
      void load();
      return;
    }
    setBookConfirmRequestId(requestId);
  };

  const finalizeBookingFromModal = async (requestId: string) => {
    setBookingId(requestId);
    try {
      const res = await createBooking(requestId);
      setBookConfirmRequestId(null);
      enqueueSnackbar(t('rentals.clientRequests.bookSuccess', 'Booking created'), {
        variant: 'success',
      });
      navigate(`/rentals/bookings/${res.bookingId}`);
    } catch (e: unknown) {
      enqueueSnackbar(
        rentalBookingErrorIsExpired(e)
          ? t(
              'rentals.clientRequests.contractExpiredBookError',
              'This offer has expired. Send a new request from the listing.'
            )
          : apiErrorMessage(
              e,
              t('rentals.clientRequests.bookError', 'Could not complete booking')
            ),
        { variant: 'error' }
      );
      setBookConfirmRequestId(null);
      void load();
    } finally {
      setBookingId(null);
    }
  };

  const confirmBook = async () => {
    if (!bookConfirmRequestId) return;
    const row = rows.find((r) => r.id === bookConfirmRequestId);
    if (!row || row.status !== 'available' || !isProposedContractOpen(row)) {
      enqueueSnackbar(
        t(
          'rentals.clientRequests.contractExpiredBookError',
          'This offer has expired. Send a new request from the listing.'
        ),
        { variant: 'error' }
      );
      setBookConfirmRequestId(null);
      void load();
      return;
    }
    await finalizeBookingFromModal(bookConfirmRequestId);
  };

  const confirmCancel = async () => {
    if (!cancelModalId) return;
    setCancelSubmitting(true);
    try {
      await cancelClientRentalRequest(cancelModalId);
      enqueueSnackbar(t('rentals.clientRequests.cancelSuccess', 'Request cancelled'), {
        variant: 'success',
      });
      setCancelModalId(null);
      await load();
    } catch (e: unknown) {
      enqueueSnackbar(
        apiErrorMessage(
          e,
          t('rentals.clientRequests.cancelError', 'Could not cancel request')
        ),
        { variant: 'error' }
      );
    } finally {
      setCancelSubmitting(false);
    }
  };

  const cancelTargetRow = cancelModalId
    ? rows.find((r) => r.id === cancelModalId)
    : undefined;
  const cancelModalIsOffer = cancelTargetRow?.status === 'available';

  const bookConfirmRow = bookConfirmRequestId
    ? rows.find((r) => r.id === bookConfirmRequestId)
    : undefined;

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '50vh', bgcolor: alpha(theme.palette.divider, 0.04), py: 4 }}>
        <Container maxWidth="sm">
          <Typography variant="body1">
            {t('rentals.loginToViewRequests', 'Log in to view your requests')}
          </Typography>
        </Container>
      </Box>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  return (
    <>
      <SEOHead title={t('rentals.myRequests', 'My rental requests')} />
      <Box
        sx={{
          minHeight: '100%',
          pb: 4,
          bgcolor: alpha(theme.palette.divider, 0.04),
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/rentals')}
            sx={{ mb: 2, color: 'text.secondary' }}
          >
            {t('rentals.detail.backToRentals', 'Back to rentals')}
          </Button>

          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 0.5 }}>
            {t('rentals.myRequests', 'My rental requests')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
            {t(
              'rentals.clientRequests.subtitle',
              'Track responses from businesses. Cancel requests that are still pending, or complete booking when a listing is marked available.'
            )}
          </Typography>

          {error ? (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          ) : null}

          {rows.length > 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
              >
                <FormControl size="small" sx={statusFilterFormSx}>
                  <InputLabel id="rental-requests-filter-status">
                    {t('rentals.clientRequests.filterStatus', 'Status')}
                  </InputLabel>
                  <Select
                    labelId="rental-requests-filter-status"
                    label={t('rentals.clientRequests.filterStatus', 'Status')}
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as RentalRequestStatusValue | '')
                    }
                  >
                    <MenuItem value="">
                      <em>{t('rentals.clientRequests.filterAll', 'All statuses')}</em>
                    </MenuItem>
                    {RENTAL_REQUEST_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {t(`rentals.requestStatus.${s}`, s)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {t('rentals.clientRequests.resultsCount', {
                    defaultValue: '{{shown}} of {{total}} requests',
                    shown: filteredRows.length,
                    total: rows.length,
                  })}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          <Stack spacing={2}>
            {filteredRows.map((req) => (
              <ClientRentalRequestRowCard
                key={req.id}
                row={req}
                bookingLoading={bookingId === req.id}
                onBookRequest={openBookConfirm}
                onCancel={(id) => setCancelModalId(id)}
                onViewListing={(listingId) => navigate(`/rentals/${listingId}`)}
                onViewBooking={(bId) => navigate(`/rentals/bookings/${bId}`)}
              />
            ))}
          </Stack>

          {rows.length === 0 && !error ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t('rentals.noRequests', 'No requests yet')}
              </Typography>
              <Button variant="contained" onClick={() => navigate('/rentals')}>
                {t('rentals.clientRequests.browseRentals', 'Browse rentals')}
              </Button>
            </Box>
          ) : null}

          {rows.length > 0 && filteredRows.length === 0 && !error ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t(
                  'rentals.clientRequests.noResultsForFilter',
                  'No requests match this status. Try another filter or show all.'
                )}
              </Typography>
              <Button variant="outlined" onClick={() => setStatusFilter('')}>
                {t('rentals.clientRequests.showAllStatuses', 'Show all statuses')}
              </Button>
            </Box>
          ) : null}
        </Container>
      </Box>

      <ConfirmationModal
        open={Boolean(bookConfirmRequestId)}
        maxWidth="md"
        title={t(
          'rentals.clientRequests.bookConfirmTitle',
          'Review and confirm your reservation'
        )}
        message={t(
          'rentals.clientRequests.bookConfirmMessage',
          'By continuing, you authorize us to send a secure payment request to the mobile number on your profile. Your reservation is only confirmed after you approve that request. If you do not approve it in time, this offer may lapse.'
        )}
        additionalContent={
          bookConfirmRow ? <RentalBookConfirmSummary row={bookConfirmRow} /> : null
        }
        confirmText={t('rentals.clientRequests.bookConfirmButton', 'Continue')}
        confirmColor="primary"
        loading={Boolean(bookingId && bookingId === bookConfirmRequestId)}
        onConfirm={() => void confirmBook()}
        onCancel={() => {
          if (bookingId && bookingId === bookConfirmRequestId) return;
          setBookConfirmRequestId(null);
        }}
      />

      <ConfirmationModal
        open={Boolean(cancelModalId)}
        title={
          cancelModalIsOffer
            ? t('rentals.clientRequests.cancelOfferTitle', 'Cancel this reservation?')
            : t('rentals.clientRequests.cancelConfirmTitle', 'Cancel this request?')
        }
        message={
          cancelModalIsOffer
            ? t(
                'rentals.clientRequests.cancelOfferMessage',
                'You will withdraw from this offer. The proposed contract will be cancelled and you can send a new request later if you wish.'
              )
            : t(
                'rentals.clientRequests.cancelConfirmMessage',
                'The business will no longer see this request. You can send a new request later if you change your mind.'
              )
        }
        confirmText={
          cancelModalIsOffer
            ? t('rentals.clientRequests.cancelOffer', 'Cancel reservation')
            : t('rentals.clientRequests.cancelRequest', 'Cancel request')
        }
        confirmColor="error"
        loading={cancelSubmitting}
        onConfirm={() => void confirmCancel()}
        onCancel={() => !cancelSubmitting && setCancelModalId(null)}
      />
    </>
  );
};

export default ClientRentalRequestsPage;
