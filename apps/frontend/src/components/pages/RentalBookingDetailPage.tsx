import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
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
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  type RentalBookingDetail,
  type RentalBookingPaymentStatus,
  useRentalApi,
} from '../../hooks/useRentalApi';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useRentalInspection } from '../../hooks/useRentalInspection';
import LoadingPage from '../common/LoadingPage';
import { UserMessagesComponent } from '../common/UserMessagesComponent';
import {
  DidntReceiveReportButton,
  useDidntReceiveWindow,
} from '../rentals/DidntReceiveReportButton';
import { RentalPhaseBanner } from '../rentals/RentalPhaseBanner';
import { RentalInspectionPanel } from '../rentals/RentalInspectionPanel';
import SEOHead from '../seo/SEOHead';
import { alpha, useTheme } from '@mui/material/styles';
import {
  formatRequestAmount,
  parseRentalSelectionWindows,
} from '../../utils/rentalRequestDisplay';
import { bookingRequestedPeriodLines, formatRentalPeriod } from '../../utils/rentalRequestFormat';
import {
  bookingDetailStatusLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  messagesDefaultExpanded,
} from '../../utils/rentalPhase';
import { unpaidCancelMinutesLeft } from '../../utils/rentalInspection';

const PAYMENT_POLL_MS = 4000;

function apiErrorMessage(
  err: unknown,
  fallback: string,
  translate?: (key: string, text: string) => string
): string {
  const data = (err as { response?: { status?: number; data?: { message?: string; code?: string } } })
    ?.response;
  const message = typeof data?.data?.message === 'string' ? data.data.message : '';
  if (data?.status === 426 || data?.data?.code === 'RENTAL_INSPECTION_UPDATE_REQUIRED') {
    return translate
      ? translate(
          'rentalInspection.updateRequired',
          'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.'
        )
      : 'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.';
  }
  if (data?.status === 409 && /that report changed/i.test(message)) {
    return translate
      ? translate('rentalInspection.reportChanged', 'That report changed. Review it again.')
      : message;
  }
  return message.trim() ? message : fallback;
}

/** Local `datetime-local` value (YYYY-MM-DDTHH:mm) from a Date. */
function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DETAIL_STATUS_DEFAULTS: Record<string, string> = {
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.done': 'Done',
  'rentals.bookingStatus.awaiting_return': 'Return due',
};

function BookingStatusStep({
  step,
  done,
  current,
}: {
  step: string;
  done: boolean;
  current: boolean;
}) {
  const { t } = useTranslation();
  const labelKey = bookingDetailStatusLabelKey(step);
  const color = done ? 'text.primary' : 'text.disabled';
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {done ? (
        <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
      ) : (
        <RadioButtonUnchecked sx={{ fontSize: 18, color: 'text.disabled' }} />
      )}
      <Typography variant="body2" fontWeight={current ? 700 : 400} color={color}>
        {t(labelKey, DETAIL_STATUS_DEFAULTS[labelKey] ?? step)}
      </Typography>
    </Stack>
  );
}

function BookingStatusSteps({ status }: { status: string }) {
  const { t } = useTranslation();
  const steps = bookingDetailTimeline(status);
  const current = bookingDetailTimelineIndex(steps, status);
  if (status === 'cancelled') {
    return (
      <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
        {t('rentals.cancelled', 'Booking cancelled')}
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      {steps.map((step, idx) => (
        <BookingStatusStep
          key={step}
          step={step}
          done={current >= idx}
          current={doneCurrent(current, idx)}
        />
      ))}
    </Stack>
  );
}

function doneCurrent(current: number, idx: number): boolean {
  return current === idx && current >= 0;
}

const RentalBookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useSessionAuth();
  const { profile, userType, personas, setActivePersona, loading: profileLoading } =
    useUserProfileContext();
  const [searchParams] = useSearchParams();
  const requestedPersona = searchParams.get('persona');
  const [personaReady, setPersonaReady] = useState(
    requestedPersona !== 'client' && requestedPersona !== 'business'
  );
  const { isStripeRail } = useIsStripeRail();
  const {
    fetchBookingDetail,
    getStartPin,
    cancelBooking,
    initiatePickupPayment,
    verifyStartPin,
    shareStartPin,
    getActiveStartPin,
    confirmReturn,
    getBookingPaymentStatus,
    retryBookingPayment,
  } = useRentalApi();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [reportedNow, setReportedNow] = useState(false);
  const [windowForcedClosed, setWindowForcedClosed] = useState(false);
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
  const [sharingPin, setSharingPin] = useState(false);
  const [sharedPin, setSharedPin] = useState<string | null>(null);
  const [sharedPinMessageId, setSharedPinMessageId] = useState<string | null>(
    null
  );
  const inspection = useRentalInspection(bookingId, booking);

  useEffect(() => {
    if (profileLoading) return;
    if (requestedPersona !== 'client' && requestedPersona !== 'business') {
      setPersonaReady(true);
      return;
    }
    if (userType === requestedPersona || !personas.includes(requestedPersona)) {
      setPersonaReady(true);
      return;
    }
    setPersonaReady(false);
    void setActivePersona(requestedPersona).finally(() => setPersonaReady(true));
  }, [profileLoading, requestedPersona, userType, personas, setActivePersona]);

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
    if (isAuthenticated && personaReady) void load();
  }, [load, isAuthenticated, personaReady]);

  useEffect(() => {
    if (!bookingId || !isAuthenticated || booking?.status !== 'confirmed') {
      setSharedPin(null);
      setSharedPinMessageId(null);
      return;
    }
    if (profile?.business?.id && booking.business_id === profile.business.id) {
      if (booking.inspection_policy_version != null) return;
      void getActiveStartPin(bookingId)
        .then((active) => {
          if (active?.pin) {
            setSharedPin(active.pin);
            setSharedPinMessageId(active.messageId);
            setPin(active.pin);
          } else {
            setSharedPin(null);
            setSharedPinMessageId(null);
          }
        })
        .catch(() => {
          setSharedPin(null);
          setSharedPinMessageId(null);
        });
    }
  }, [
    booking?.business_id,
    booking?.inspection_policy_version,
    booking?.status,
    bookingId,
    getActiveStartPin,
    isAuthenticated,
    profile?.business?.id,
  ]);

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
          t('rentals.bookingDetail.retryPaymentError', 'Could not retry payment'),
          t
        )
      );
    } finally {
      setRetryingPayment(false);
    }
  };

  const didntWindowOpen = useDidntReceiveWindow(
    booking?.inspection_policy_version != null,
    booking?.actual_start_at
  );
  const reportedMissingItem = reportedNow || Boolean(booking?.not_received_report);
  useEffect(() => {
    setReportedNow(false);
    setWindowForcedClosed(false);
  }, [bookingId]);

  const isClient = profile?.client?.id === booking?.client_id;
  const isBusiness = profile?.business?.id === booking?.business_id;
  const showClientPin = isClient && inspection.gate.showStart && !inspection.loading;
  const showCollect = isBusiness && inspection.gate.showCollectPayment && !inspection.loading;
  const showVerify = isBusiness && inspection.gate.showStart && !inspection.loading;
  const showReturnPicker = isBusiness && inspection.showLegacyReturn;
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
  const selectionWindows = parseRentalSelectionWindows(
    booking.rental_request?.rental_selection_windows
  );
  const dayCountLabel = (count: number) =>
    t('rentals.clientRequests.periodDayCount', {
      count,
      defaultValue: count === 1 ? '{{count}} day' : '{{count}} days',
    });
  const periodLines = bookingRequestedPeriodLines(
    selectionWindows,
    booking,
    i18n.language,
    dayCountLabel
  );
  const returnByLabel = booking.end_at
    ? formatRentalPeriod(
        [{ start_at: booking.end_at, end_at: booking.end_at }],
        i18n.language,
        dayCountLabel
      )
    : '—';
  const detailStatusKey = bookingDetailStatusLabelKey(status);
  const detailStatusLabel = t(
    detailStatusKey,
    DETAIL_STATUS_DEFAULTS[detailStatusKey] ?? status
  );
  const formatDetailMoney = (amount: number) =>
    formatRequestAmount(amount, booking.currency || 'XAF', i18n.language);

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
        apiErrorMessage(e, t('rentals.cancelError', 'Could not cancel booking'), t)
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
          t('rentals.bookingDetail.pickupPaymentError', 'Could not collect payment'),
          t
        )
      );
    }
  };

  return (
    <>
      <SEOHead title={title} />
      <Box sx={{ minHeight: '100%', pb: { xs: 10, md: 5 }, bgcolor: alpha(theme.palette.divider, 0.04) }}>
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
                (status === 'awaiting_return'
                  ? t(detailStatusKey, 'Return due')
                  : t(`rentals.bookingStatus.${status}`, status))
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

          <Box sx={{ mb: 2 }}>
            <RentalPhaseBanner
              bookingStatus={status}
              chipLabel={detailStatusLabel}
              role={isBusiness ? 'business' : 'client'}
              nextStepKey={
                inspection.enrolled && (status === 'reserved' || status === 'confirmed')
                  ? isBusiness
                    ? 'rentalInspection.bannerWaiting'
                    : 'rentalInspection.bannerReview'
                  : undefined
              }
              action={
                showPaymentPending ? (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isStripePending
                        ? t(
                            'rentals.bookingDetail.paymentPendingStripe',
                            'Complete card payment in Stripe Checkout to confirm this reservation. Use Retry payment if you closed the checkout page.'
                          )
                        : t(
                            'rentals.bookingDetail.paymentPendingMomo',
                            'Approve the mobile money payment request on your phone to confirm this reservation. Use Retry payment if you did not receive it.'
                          )}
                    </Typography>
                    <Button
                      variant="contained"
                      color="cta"
                      disabled={retryingPayment}
                      onClick={() => void handleRetryPayment()}
                    >
                      {t('rentals.actions.completePayment', 'Complete payment')}
                    </Button>
                  </Stack>
                ) : showClientPin ? (
                  <Stack spacing={1}>
                    <Button
                      variant="contained"
                      disabled={sharingPin}
                      onClick={async () => {
                        if (!bookingId) return;
                        setSharingPin(true);
                        try {
                          await shareStartPin(bookingId);
                          setInfo(
                            t(
                              'rentals.messaging.startPin.sentConfirmation',
                              'PIN shared in booking chat. The business will be notified.'
                            )
                          );
                          setError(null);
                        } catch (e: unknown) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : t(
                                  'rentals.messaging.startPin.unavailable',
                                  'Start PIN is not available. Try again in a moment.'
                                )
                          );
                        } finally {
                          setSharingPin(false);
                        }
                      }}
                    >
                      {t('rentals.actions.sendStartPin', 'Send start PIN')}
                    </Button>
                    <Button
                      variant="outlined"
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
                      {t('rentals.actions.showStartPin', 'Show PIN on screen')}
                    </Button>
                  </Stack>
                ) : showCollect ? (
                  <Stack spacing={1}>
                    {inspection.enrolled && unpaidCancelMinutesLeft(booking.reserved_cancel_after) != null ? (
                      <Alert severity="warning">
                        {t('rentalInspection.autoCancel', 'Auto-cancel if unpaid: {{minutes}} min left. The clock started when Collect payment opened. Inspection time is not included.', {
                          minutes: unpaidCancelMinutesLeft(booking.reserved_cancel_after),
                        })}
                      </Alert>
                    ) : null}
                    <Button
                      variant="contained"
                      onClick={() => void handlePickupPayment()}
                    >
                      {t('rentals.actions.collectPayment', 'Collect payment')}
                    </Button>
                  </Stack>
                ) : showVerify ? (
                  <Button
                    variant="contained"
                    onClick={() => {
                      const el = document.getElementById('rental-verify-start');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {t('rentals.actions.verifyStartPin', 'Verify start PIN')}
                  </Button>
                ) : showReturnPicker ? (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      setReturnAtLocal(toDateTimeLocalValue(new Date()));
                      setReturnDialogOpen(true);
                    }}
                  >
                    {t('rentals.actions.confirmReturn', 'Confirm return')}
                  </Button>
                ) : null
              }
            />
          </Box>

          {bookingId && inspection.enrolled ? (
            <Box id="rental-inspection">
              <RentalInspectionPanel
                bookingId={bookingId}
                role={isBusiness ? 'business' : 'client'}
                booking={booking}
                model={inspection}
                onChanged={() => void load()}
              />
            </Box>
          ) : null}

          {isClient &&
          (booking.status === 'active' ||
            booking.status === 'awaiting_return') ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t(
                'rentals.nextStep.returnReminder',
                'Return by {{time}} at {{location}}. The business will confirm when the item is back.',
                { time: returnByLabel, location: locationName }
              )}
              {overtimeAmount > 0
                ? ` ${t(
                    'rentals.nextStep.overtimePending',
                    'Overtime payment in progress: {{amount}}.',
                    {
                      amount: `${overtimeAmount} ${booking.currency}`,
                    }
                  )}`
                : ''}
            </Alert>
          ) : null}

          {isClient &&
          bookingId &&
          (reportedMissingItem || (didntWindowOpen && !windowForcedClosed)) ? (
            <DidntReceiveReportButton
              bookingId={bookingId}
              reported={reportedMissingItem}
              onReported={() => setReportedNow(true)}
              onWindowClosed={() => setWindowForcedClosed(true)}
            />
          ) : null}

          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={900}>
                {t('rentals.status', 'Status')}
              </Typography>
              <BookingStatusSteps status={status} />
            </Paper>
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
                    <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                      {(periodLines.length ? periodLines : ['—']).map((line, idx) => (
                        <Typography key={`${idx}-${line}`} variant="body1" fontWeight={700}>
                          {line}
                        </Typography>
                      ))}
                    </Stack>
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
                    {formatDetailMoney(Number(booking.total_amount) || 0)}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {depositAmount > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}:{' '}
                        <strong>
                          {formatDetailMoney(depositAmount)}
                        </strong>
                      </Typography>
                    ) : null}
                    {booking.payment_status === 'authorized' && authorizedAmount > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'rentals.bookingDetail.authorizedOnCard',
                          'Held on your card (rental + deposit): {{amount}}. The final charge at return is at least the rental total; the deposit only covers extra hours.',
                          { amount: formatDetailMoney(authorizedAmount) }
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

                {isClient && cancellableBeforeStart ? (
                  <Button
                    color="warning"
                    variant="outlined"
                    onClick={() => void handleCancelBooking()}
                  >
                    {t('rentals.cancelBooking', 'Cancel booking')}
                  </Button>
                ) : null}

                {isBusiness && booking.status === 'reserved' && cancellableBeforeStart ? (
                  <Button
                    color="warning"
                    variant="outlined"
                    onClick={() => void handleCancelBooking()}
                  >
                    {t('rentals.cancelBooking', 'Cancel booking')}
                  </Button>
                ) : null}

                {showVerify ? (
                  <Box id="rental-verify-start" sx={{ mt: isClient ? 2 : 0 }}>
                    <Stack spacing={1.25}>
                      {sharedPin ? (
                        <Alert severity="info">
                          {t(
                            'rentals.messaging.startPin.usingShared',
                            'Using the start PIN shared by the client in chat.'
                          )}{' '}
                          <Typography
                            component="span"
                            sx={{ fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }}
                          >
                            {sharedPin}
                          </Typography>
                        </Alert>
                      ) : null}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          label={t('rentals.clientPin', 'Client PIN')}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                        />
                        {inspection.enrolled ? (
                          <Typography color="text.secondary">
                            {t('rentalInspection.overwriteSupportOnly', 'Overwrite codes are issued by Rendasua support only — not shown here.')}
                          </Typography>
                        ) : (
                        <TextField
                          fullWidth
                          label={t('rentals.overwriteCode', 'Overwrite code')}
                          value={ow}
                          onChange={(e) => setOw(e.target.value)}
                          helperText={t(
                            'rentals.supportCodeHint',
                            'Ask the client for their start PIN. A support code is only for when the client cannot share it, and only support can issue one.'
                          )}
                        />
                        )}
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                          variant="contained"
                          onClick={async () => {
                            try {
                              if (sharedPin && pin === sharedPin && !ow) {
                                await verifyStartPin(bookingId, {
                                  useLatestSharedPin: true,
                                  pinMessageId: sharedPinMessageId || undefined,
                                });
                              } else {
                                await verifyStartPin(bookingId, {
                                  pin: pin || undefined,
                                  overwriteCode: inspection.enrolled ? undefined : ow || undefined,
                                });
                              }
                              setInfo(t('rentals.started', 'Rental started'));
                              void load();
                            } catch (e: unknown) {
                              setError(apiErrorMessage(e, e instanceof Error ? e.message : 'Error', t));
                            }
                          }}
                        >
                          {t('rentals.verifyStart', 'Verify start')}
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

              </Paper>
            ) : null}

            {bookingId && booking.status !== 'cancelled' ? (
              <UserMessagesComponent
                entityType="rental_booking"
                entityId={bookingId}
                title={t('rentals.messages.title', 'Messages')}
                defaultExpanded={messagesDefaultExpanded(booking.status)}
                maxVisibleMessages={5}
              />
            ) : null}
          </Stack>
        </Container>
      </Box>

      {(showPaymentPending || showCollect || showVerify || showReturnPicker) && (
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            p: 1.5,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            boxShadow: 3,
          }}
        >
          {showPaymentPending ? (
            <Button
              fullWidth
              variant="contained"
              color="cta"
              disabled={retryingPayment}
              onClick={() => void handleRetryPayment()}
            >
              {t('rentals.actions.completePayment', 'Complete payment')}
            </Button>
          ) : showCollect ? (
            <Button
              fullWidth
              variant="contained"
              onClick={() => void handlePickupPayment()}
            >
              {t('rentals.actions.collectPayment', 'Collect payment')}
            </Button>
          ) : showVerify ? (
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                const el = document.getElementById('rental-verify-start');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {t('rentals.actions.verifyStartPin', 'Verify start PIN')}
            </Button>
          ) : showReturnPicker ? (
            <Button
              fullWidth
              variant="contained"
              color="success"
              onClick={() => {
                setReturnAtLocal(toDateTimeLocalValue(new Date()));
                setReturnDialogOpen(true);
              }}
            >
              {t('rentals.actions.confirmReturn', 'Confirm return')}
            </Button>
          ) : null}
        </Box>
      )}

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
                    e instanceof Error ? e.message : 'Error',
                    t
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
