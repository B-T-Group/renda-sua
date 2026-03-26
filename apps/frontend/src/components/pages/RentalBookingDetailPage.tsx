import {
  Alert,
  Avatar,
  Chip,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { type RentalBookingDetail, useRentalApi } from '../../hooks/useRentalApi';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';
import { alpha, useTheme } from '@mui/material/styles';
import {
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
} from '../../utils/rentalRequestDisplay';

const RentalBookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { profile } = useUserProfileContext();
  const {
    fetchBookingDetail,
    getStartPin,
    cancelBooking,
    verifyStartPin,
    generateOverwrite,
    confirmReturn,
  } = useRentalApi();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [ow, setOw] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const b = await fetchBookingDetail(bookingId);
      setBooking(b);
      setError(b ? null : t('rentals.bookingNotFound', 'Booking not found'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [bookingId, fetchBookingDetail, t]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [load, isAuthenticated]);

  const isClient = profile?.client?.id === booking?.client_id;
  const isBusiness = profile?.business?.id === booking?.business_id;

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '55vh', bgcolor: alpha(theme.palette.divider, 0.04), py: 4 }}>
        <Container maxWidth="md">
          <Alert severity="info">
            {t('rentals.loginToViewBooking', 'Log in to view this booking')}
          </Alert>
        </Container>
      </Box>
    );
  }

  if (loading || !bookingId) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  if (!booking) {
    return (
      <Box sx={{ minHeight: '55vh', bgcolor: alpha(theme.palette.divider, 0.04), py: 4 }}>
        <Container maxWidth="md">
          <Button
            onClick={() => navigate(-1)}
            sx={{ mb: 2, color: 'text.secondary' }}
          >
            {t('common.back', 'Back')}
          </Button>
          <Typography variant="h6">
            {t('rentals.bookingNotFound', 'Booking not found')}
          </Typography>
        </Container>
      </Box>
    );
  }

  const title = booking.rental_location_listing?.rental_item?.name ?? 'Rental';
  const locationName = booking.rental_location_listing?.business_location?.name ?? '—';
  const status = booking.status ?? '—';
  const bookingImage = booking.rental_location_listing?.rental_item?.rental_item_images?.[0];
  const imageUrl = bookingImage?.image_url?.trim() || '';
  const imageAlt = bookingImage?.alt_text?.trim() || title;
  const pricing = parseRentalPricingSnapshot(booking.rental_pricing_snapshot);
  const isAllDay =
    (pricing?.lines?.length ?? 0) > 0 &&
    pricing?.lines?.every((l) => l.kind === 'all_day') === true;
  const startLocal = formatRentalRequestLocalDateTime(booking.start_at);
  const endLocal = formatRentalRequestLocalDateTime(booking.end_at);
  const selectionWindows = parseRentalSelectionWindows(
    booking.rental_request?.rental_selection_windows
  );
  const bookingWindows = selectionWindows.length
    ? selectionWindows
    : [
        {
          start_at: booking.start_at,
          end_at: booking.end_at,
          billing: isAllDay ? 'all_day' : 'hourly',
        },
      ];

  const statusChipColor =
    status === 'confirmed'
      ? ('success' as const)
      : status === 'active'
        ? ('info' as const)
        : status === 'awaiting_return'
          ? ('warning' as const)
          : status === 'completed'
            ? ('default' as const)
            : status === 'cancelled'
              ? ('error' as const)
              : ('default' as const);

  return (
    <>
      <SEOHead title={title} />
      <Box sx={{ minHeight: '100%', pb: 5, bgcolor: alpha(theme.palette.divider, 0.04) }}>
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 3 } }}>
          <Button
            onClick={() => navigate(-1)}
            sx={{ mb: 2, color: 'text.secondary' }}
          >
            {t('common.back', 'Back')}
          </Button>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" component="h1" fontWeight={900} sx={{ lineHeight: 1.15 }}>
                {title}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                {booking.booking_number ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('rentals.bookingNumber', 'Booking')}: <strong>{booking.booking_number}</strong>
                  </Typography>
                ) : null}
                <Typography variant="body2" color="text.secondary">
                  {locationName}
                </Typography>
              </Stack>
            </Box>
            <Chip
              label={t('rentals.status', 'Status') + ': ' + status}
              color={statusChipColor}
              sx={{ fontWeight: 800 }}
            />
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {info}
            </Alert>
          ) : null}

          {isClient && booking.status === 'confirmed' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t(
                'rentals.pinShareHint',
                'Share this code with the owner to start the rental.'
              )}
            </Alert>
          ) : null}

          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={1.25}>
                <Typography variant="h6" fontWeight={900}>
                  {t('rentals.clientRequests.bookConfirmSummaryHeading', 'Booking summary')}
                </Typography>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  {imageUrl ? (
                    <Box
                      component="img"
                      src={imageUrl}
                      alt={imageAlt}
                      sx={{
                        width: 88,
                        height: 88,
                        borderRadius: 2,
                        objectFit: 'cover',
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'action.hover',
                      }}
                    />
                  ) : (
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 88,
                        height: 88,
                        borderRadius: 2,
                        fontWeight: 900,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                      }}
                    >
                      {title?.trim()?.[0]?.toUpperCase() ?? 'R'}
                    </Avatar>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={900} noWrap>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {locationName}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('rentals.clientRequests.bookConfirmLabelLocation', 'Pickup location')}
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {locationName}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('rentals.clientRequests.bookConfirmLabelPeriod', 'Rental period')}
                    </Typography>
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                      }}
                    >
                      <Typography variant="body2" fontWeight={800} sx={{ mb: 0.6 }}>
                        {`${startLocal} → ${endLocal}`}
                      </Typography>
                      <Stack spacing={0.6}>
                        {bookingWindows.map((window, idx) => (
                          <Box
                            key={`${window.start_at}-${window.end_at}-${idx}`}
                            sx={{
                              px: 1,
                              py: 0.75,
                              borderRadius: 1,
                              border: 1,
                              borderColor: alpha(theme.palette.divider, 0.8),
                              bgcolor: 'background.paper',
                            }}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {window.billing === 'all_day'
                                ? `${formatRentalRequestLocalDateTime(window.start_at)} — ${t('rentals.allDay', 'All day')}`
                                : `${formatRentalRequestLocalDateTime(window.start_at)} → ${formatRentalRequestLocalDateTime(window.end_at)}`}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    mt: 0.5,
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderColor: alpha(theme.palette.success.main, 0.25),
                    bgcolor: alpha(theme.palette.success.main, 0.06),
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('rentals.clientRequests.bookConfirmLabelTotal', 'Quoted total')}
                  </Typography>
                  <Typography variant="h5" fontWeight={900} color="success.dark">
                    {booking.total_amount} {booking.currency}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {isBusiness && booking.client?.user ? (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  {t('business.rentals.clientDetails', 'Client details')}
                </Typography>
                <Stack spacing={0.4}>
                  <Typography variant="body2">
                    <strong>{t('common.name', 'Name')}:</strong>{' '}
                    {`${booking.client.user.first_name ?? ''} ${booking.client.user.last_name ?? ''}`.trim() ||
                      '—'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('common.phone', 'Phone')}:</strong>{' '}
                    {booking.client.user.phone_number || '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>{t('common.email', 'Email')}:</strong>{' '}
                    {booking.client.user.email || '—'}
                  </Typography>
                </Stack>
              </Paper>
            ) : null}

            {(isClient && booking.status === 'confirmed') ||
            (isBusiness && (booking.status === 'confirmed' || booking.status === 'awaiting_return')) ? (
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
                  {t('common.actions', 'Actions')}
                </Typography>

                {isClient && booking.status === 'confirmed' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        try {
                          const r = await getStartPin(bookingId);
                          setPinValue(r.pin);
                          setPinModalOpen(true);
                          setError(null);
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : 'Error');
                        }
                      }}
                    >
                      {t('rentals.showStartPin', 'Show start PIN')}
                    </Button>
                    <Button
                      color="warning"
                      variant="outlined"
                      onClick={async () => {
                        try {
                          await cancelBooking(bookingId);
                          setInfo(t('rentals.cancelled', 'Booking cancelled'));
                          void load();
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : 'Error');
                        }
                      }}
                    >
                      {t('rentals.cancelBooking', 'Cancel booking')}
                    </Button>
                  </Stack>
                ) : null}

                {isBusiness && booking.status === 'confirmed' ? (
                  <Box sx={{ mt: isClient ? 2 : 0 }}>
                    <Stack spacing={1.25}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          label={t('rentals.clientPin', 'Client PIN')}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                        />
                        <TextField
                          fullWidth
                          label={t('rentals.overwriteCode', 'Overwrite code')}
                          value={ow}
                          onChange={(e) => setOw(e.target.value)}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                          variant="contained"
                          onClick={async () => {
                            try {
                              await verifyStartPin(bookingId, {
                                pin: pin || undefined,
                                overwriteCode: ow || undefined,
                              });
                              setInfo(t('rentals.started', 'Rental started'));
                              void load();
                            } catch (e: unknown) {
                              setError(e instanceof Error ? e.message : 'Error');
                            }
                          }}
                        >
                          {t('rentals.verifyStart', 'Verify start')}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={async () => {
                            try {
                              const r = await generateOverwrite(bookingId);
                              setInfo(`${t('rentals.overwrite', 'Overwrite')}: ${r.overwriteCode}`);
                            } catch (e: unknown) {
                              setError(e instanceof Error ? e.message : 'Error');
                            }
                          }}
                        >
                          {t('rentals.genOverwrite', 'Generate overwrite code')}
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}

                {isBusiness && booking.status === 'awaiting_return' ? (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={async () => {
                      try {
                        await confirmReturn(bookingId);
                        setInfo(t('rentals.completed', 'Completed and settled'));
                        void load();
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : 'Error');
                      }
                    }}
                  >
                    {t('rentals.confirmReturn', 'Confirm return')}
                  </Button>
                ) : null}
              </Paper>
            ) : null}
          </Stack>
        </Container>
      </Box>

      <Dialog
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('rentals.showStartPin', 'Show start PIN')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('rentals.yourPin', 'Your start PIN')}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              letterSpacing: 4,
              textAlign: 'center',
              py: 1,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.info.main, 0.06),
            }}
          >
            {pinValue ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>
            {t(
              'rentals.pinShareHint',
              'Share this code with the owner to start the rental.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinModalOpen(false)}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RentalBookingDetailPage;
