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
import {
  type RentalBookingDetail,
  type RentalBookingPaymentStatus,
  useRentalApi,
} from '../../hooks/useRentalApi';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import { UserMessagesComponent } from '../common/UserMessagesComponent';
import SEOHead from '../seo/SEOHead';
import { alpha, useTheme } from '@mui/material/styles';
import {
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
} from '../../utils/rentalRequestDisplay';

const PAYMENT_POLL_MS = 4000;

function apiErrorMessage(err: unknown, fallback: string): string {
  const m = (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

/** Local `datetime-local` value (YYYY-MM-DDTHH:mm) from a Date. */
function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RentalBookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { profile } = useUserProfileContext();
  const { isStripeRail } = useIsStripeRail();
  const {
    fetchBookingDetail,
    getStartPin,
    cancelBooking,
    initiatePickupPayment,
    verifyStartPin,
    generateOverwrite,
    confirmReturn,
    getBookingPaymentStatus,
    retryBookingPayment,
  } = useRentalApi();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [paymentStatus, setPaymentStatus] =
    useState<RentalBookingPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [ow, setOw] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState<string | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnAtLocal, setReturnAtLocal] = useState(() =>
    toDateTimeLocalValue(new Date())
  );
  const [returning, setReturning] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const b = await fetchBookingDetail(bookingId);
      setBooking(b);
      setError(b ? null : t('rentals.bookingNotFound', 'Booking not found'));
      if (b?.status === 'proposed') {
        try {
          setPaymentStatus(await getBookingPaymentStatus(bookingId));
        } catch {
          setPaymentStatus(null);
        }
      } else {
        setPaymentStatus(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [bookingId, fetchBookingDetail, getBookingPaymentStatus, t]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [load, isAuthenticated]);

  useEffect(() => {
    if (!bookingId || booking?.status !== 'proposed') return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const pay = await getBookingPaymentStatus(bookingId);
          setPaymentStatus(pay);
          if (pay.status !== 'proposed') {
            const b = await fetchBookingDetail(bookingId);
            if (b) setBooking(b);
          }
        } catch {
          /* keep last known */
        }
      })();
    }, PAYMENT_POLL_MS);
    return () => clearInterval(timer);
  }, [bookingId, booking?.status, getBookingPaymentStatus, fetchBookingDetail]);

  const handleRetryPayment = async () => {
    if (!bookingId) return;
    setRetryingPayment(true);
    setError(null);
    try {
      const res = await retryBookingPayment(bookingId);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      if (res.confirmed) {
        setInfo(
          t('rentals.bookingDetail.paymentConfirmed', 'Payment confirmed')
        );
      } else {
        setInfo(
          t(
            'rentals.bookingDetail.retryPaymentSuccess',
            'Payment request sent. Complete payment to confirm your booking.'
          )
        );
      }
      await load();
    } catch (e: unknown) {
      setError(
        apiErrorMessage(
          e,
          t('rentals.bookingDetail.retryPaymentError', 'Could not retry payment')
        )
      );
    } finally {
      setRetryingPayment(false);
    }
  };

  const isClient = profile?.client?.id === booking?.client_id;
  const isBusiness = profile?.business?.id === booking?.business_id;
  const paymentRail = paymentStatus?.payment_rail;
  const isStripePending =
    paymentRail === 'stripe' || (paymentRail == null && isStripeRail);
  const showPaymentPending = isClient && booking?.status === 'proposed';

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
      : status === 'reserved'
        ? ('info' as const)
        : status === 'active'
          ? ('info' as const)
          : status === 'awaiting_return'
            ? ('warning' as const)
            : status === 'completed'
              ? ('default' as const)
              : status === 'cancelled'
                ? ('error' as const)
                : ('default' as const);

  const depositAmount = Number(booking.security_deposit_amount) || 0;
  const authorizedAmount = Number(booking.authorized_amount) || 0;
  const overtimeAmount = Number(booking.overtime_amount) || 0;
  const cancellableBeforeStart =
    (status === 'confirmed' || status === 'reserved') && !booking.actual_start_at;

  const handleCancelBooking = async () => {
    try {
      await cancelBooking(bookingId);
      setInfo(t('rentals.cancelled', 'Booking cancelled'));
      void load();
    } catch (e: unknown) {
      setError(
        apiErrorMessage(e, t('rentals.cancelError', 'Could not cancel booking'))
      );
    }
  };

  const handlePickupPayment = async () => {
    try {
      const res = await initiatePickupPayment(bookingId);
      setInfo(
        res.confirmed
          ? t('rentals.bookingDetail.pickupPaid', 'Payment collected — rental confirmed')
          : t(
              'rentals.bookingDetail.pickupPaymentSent',
              'Mobile money request sent to the client. The booking confirms once payment lands.'
            )
      );
      void load();
    } catch (e: unknown) {
      setError(
        apiErrorMessage(
          e,
          t('rentals.bookingDetail.pickupPaymentError', 'Could not collect payment')
        )
      );
    }
  };

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
              label={
                t('rentals.status', 'Status') +
                ': ' +
                t(`rentals.bookingStatus.${status}`, status)
              }
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

          {showPaymentPending ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={retryingPayment}
                  onClick={() => void handleRetryPayment()}
                >
                  {t('rentals.bookingDetail.retryPayment', 'Retry payment')}
                </Button>
              }
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                {t(
                  'rentals.bookingDetail.paymentPendingTitle',
                  'Waiting for payment'
                )}
              </Typography>
              {isStripePending
                ? t(
                    'rentals.bookingDetail.paymentPendingStripe',
                    'Complete card payment in Stripe Checkout to confirm this reservation. Use Retry payment if you closed the checkout page.'
                  )
                : t(
                    'rentals.bookingDetail.paymentPendingMomo',
                    'Approve the mobile money payment request on your phone to confirm this reservation. Use Retry payment if you did not receive it.'
                  )}
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

          {booking.status === 'reserved' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {isClient
                ? t(
                    'rentals.bookingDetail.reservedClientHint',
                    'Your reservation is held for free. Pay the rental total at pickup to receive your start PIN.'
                  )
                : t(
                    'rentals.bookingDetail.reservedBusinessHint',
                    'Reserved without payment. Collect the rental total at pickup — the start PIN unlocks after payment.'
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
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {depositAmount > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}:{' '}
                        <strong>
                          {depositAmount} {booking.currency}
                        </strong>
                      </Typography>
                    ) : null}
                    {booking.payment_status === 'authorized' && authorizedAmount > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'rentals.bookingDetail.authorizedOnCard',
                          'Held on your card (rental + deposit): {{amount}} {{currency}}. The final charge at return is at least the rental total; the deposit only covers extra hours.',
                          { amount: authorizedAmount, currency: booking.currency }
                        )}
                      </Typography>
                    ) : null}
                    {booking.payment_timing === 'pay_at_pickup' &&
                    booking.payment_status === 'pending' ? (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'rentals.bookingDetail.payAtPickup',
                          'Nothing paid yet — the rental total is due at pickup.'
                        )}
                      </Typography>
                    ) : null}
                    {overtimeAmount > 0 ? (
                      <Typography variant="body2" color="warning.main" fontWeight={700}>
                        {t(
                          'rentals.bookingDetail.overtimeDue',
                          'Extra hours: {{amount}} {{currency}}',
                          { amount: overtimeAmount, currency: booking.currency }
                        )}
                      </Typography>
                    ) : null}
                    {cancellableBeforeStart ? (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'rentals.clientRequests.freeCancelBeforeStart',
                          'Free cancellation any time before the rental starts.'
                        )}
                      </Typography>
                    ) : null}
                  </Stack>
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

            {(isClient && (booking.status === 'confirmed' || booking.status === 'reserved')) ||
            (isBusiness &&
              (booking.status === 'confirmed' ||
                booking.status === 'reserved' ||
                booking.status === 'active' ||
                booking.status === 'awaiting_return')) ? (
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
                  {t('common.actions', 'Actions')}
                </Typography>

                {isClient && (booking.status === 'confirmed' || booking.status === 'reserved') ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    {booking.status === 'confirmed' ? (
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
                    ) : null}
                    {cancellableBeforeStart ? (
                      <Button
                        color="warning"
                        variant="outlined"
                        onClick={() => void handleCancelBooking()}
                      >
                        {t('rentals.cancelBooking', 'Cancel booking')}
                      </Button>
                    ) : null}
                  </Stack>
                ) : null}

                {isBusiness && booking.status === 'reserved' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      variant="contained"
                      onClick={() => void handlePickupPayment()}
                    >
                      {t('rentals.bookingDetail.collectPickupPayment', 'Collect payment')}
                    </Button>
                    <Button
                      color="warning"
                      variant="outlined"
                      onClick={() => void handleCancelBooking()}
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
                        {cancellableBeforeStart ? (
                          <Button
                            color="warning"
                            variant="outlined"
                            onClick={() => void handleCancelBooking()}
                          >
                            {t('rentals.cancelBooking', 'Cancel booking')}
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}

                {isBusiness &&
                (booking.status === 'active' ||
                  booking.status === 'awaiting_return') ? (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      setReturnAtLocal(toDateTimeLocalValue(new Date()));
                      setReturnDialogOpen(true);
                    }}
                  >
                    {t('rentals.confirmReturn', 'Confirm return')}
                  </Button>
                ) : null}
              </Paper>
            ) : null}

            {bookingId && booking.status !== 'cancelled' ? (
              <UserMessagesComponent
                entityType="rental_booking"
                entityId={bookingId}
                title={t('rentals.messages.title', 'Messages')}
                defaultExpanded
                maxVisibleMessages={5}
              />
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

      <Dialog
        open={returnDialogOpen}
        onClose={() => !returning && setReturnDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('rentals.confirmReturn', 'Confirm return')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'rentals.returnAtHint',
              'Select when the item was returned. Early returns still pay the full rental total; time after the booked end is billed as overtime.'
            )}
          </Typography>
          <TextField
            label={t('rentals.returnAt', 'Return date and time')}
            type="datetime-local"
            value={returnAtLocal}
            onChange={(e) => setReturnAtLocal(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={returning}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialogOpen(false)} disabled={returning}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={returning || !returnAtLocal}
            onClick={async () => {
              if (!bookingId || !returnAtLocal) return;
              setReturning(true);
              try {
                const actualEndAt = new Date(returnAtLocal).toISOString();
                const res = await confirmReturn(bookingId, { actualEndAt });
                setReturnDialogOpen(false);
                if (res.paymentPending || res.overtimeDue) {
                  setInfo(
                    t(
                      'rentals.returnOvertimePending',
                      'Return recorded. A payment request for the extra hours was sent to the client — the booking completes once it is paid.'
                    )
                  );
                } else {
                  setInfo(t('rentals.completed', 'Completed and settled'));
                }
                void load();
              } catch (e: unknown) {
                setError(
                  apiErrorMessage(
                    e,
                    e instanceof Error ? e.message : 'Error'
                  )
                );
              } finally {
                setReturning(false);
              }
            }}
          >
            {t('rentals.confirmReturn', 'Confirm return')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RentalBookingDetailPage;
