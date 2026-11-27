import { Cancel, CheckCircle, Lens, RadioButtonUnchecked } from '@mui/icons-material';
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  type RentalBookingDetail,
  type RentalBookingPaymentStatus,
  useRentalApi,
} from '../../hooks/useRentalApi';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useRentalBookingUnreadCount } from '../../hooks/useRentalBookingUnreadCount';
import { useRentalInspection } from '../../hooks/useRentalInspection';
import { RentalMessagesButton } from '../rentals/RentalMessagesButton';
import { MerchantEarningsCard } from '../rentals/MerchantEarningsCard';
import LoadingPage from '../common/LoadingPage';
import { UserMessagesComponent } from '../common/UserMessagesComponent';
import {
  DidntReceiveReportButton,
  useDidntReceiveWindow,
} from '../rentals/DidntReceiveReportButton';
import { RentalPhaseBanner } from '../rentals/RentalPhaseBanner';
import { RenterReturnPanel } from '../rentals/RenterReturnPanel';
import { RentalInspectionPanel } from '../rentals/RentalInspectionPanel';
import { BusinessDeclineBanner, DeclineOutcomeCard, declineCardView } from '../rentals/DeclinePickupScreens';
import { RentalJourneyList } from '../rentals/RentalJourneyList';
import { RentalStartPanel } from '../rentals/RentalStartPanel';
import { STICKY_ACTION_CLEARANCE, StickyActionCard } from '../common/StickyActionCard';
import { PayAtPickupPanel } from '../rentals/PayAtPickupPanel';
import { CancelBookingDialog } from '../rentals/CancelBookingDialog';
import { cancelFeeResult, dueAtPickup, reservationFee, showsPayAtPickupCard } from '../../utils/rentals/reservationFee';
import { BusinessPhotoRequest } from '../rentals/BusinessPhotoRequest';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import { ReportSentConfirmation } from '../rentals/ReportSentConfirmation';
import { RentalStartedConfirmation } from '../rentals/RentalStartedConfirmation';
import SEOHead from '../seo/SEOHead';
import { alpha, useTheme } from '@mui/material/styles';
import {
  formatRequestAmount,
  parseRentalSelectionWindows,
} from '../../utils/rentalRequestDisplay';
import {
  BusinessEarlyReturnCard,
  BusinessItemReturnedActions,
  BusinessReturnConfirmDialog,
  RenterEarlyReturnPanel,
  RenterReturnedEarlyCard,
} from '../rentals/EarlyReturn';
import {
  bookedUntil,
  canReturnEarly,
  earlyReportPending,
  instantClock,
  returnInstantIso,
  returnedEarly,
} from '../../utils/rentals/earlyReturn';
import { cardHoldLines, holdPresentation, showsCardDeposit, type HoldPresentation } from '../../utils/rentals/cardDeposit';
import { bookingDetailPeriodLines, formatRentalPeriod } from '../../utils/rentalRequestFormat';
import { formatReturnStamp, renterReturnPhase } from '../../utils/renterReturnPhase';
import { dateTimeLocalToInstantIso, listingDateTimeLocal } from '../../utils/rentals/returnClock';
import {
  REPORT_REVIEW_STEP,
  bookingDetailStatusLabelKey,
  bookingDetailStepLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  messagesDefaultExpanded,
} from '../../utils/rentalPhase';
import {
  businessCanReplaceReport,
  didntReceiveWindowOpen,
  reportReadyToReview,
  showBusinessReturnReport,
  unpaidCancelMinutesLeft,
} from '../../utils/rentalInspection';
import { RentalHandoverNotice } from '../rentals/RentalHandoverNotice';
import {
  confirmationDepositHeld,
  confirmationTimeZone,
  confirmationZoneDefault,
  confirmationZoneKey,
  formatBookedSpan,
  formatConfirmationDue,
  formatConfirmationMoney,
} from '../../utils/rentals/confirmationFormat';
import { BOOKING_CLOCK, formatZonedDay, formatZonedWeekdayDay, formatZonedWhen, pickupClockLabel, pickupPhase, windowStatusLabel } from '../../utils/rentalStartWindow';
import { bookingReturnDue } from '../../utils/rentals/returnDue';
import { cardWindowErrorMessage } from '../../utils/rentals/cardWindow';
import {
  isPriceChangeUnseenError,
  PRICE_CHANGE_UNSEEN_KEY,
  PRICE_CHANGE_UNSEEN_TEXT,
} from '../../utils/rentals/priceChangeUnseen';

const PAYMENT_POLL_MS = 4000;

function apiErrorMessage(
  err: unknown,
  fallback: string,
  translate?: (key: string, text: string) => string
): string {
  const data = (err as { response?: { status?: number; data?: { message?: string; code?: string } } })
    ?.response;
  const friendly = cardWindowErrorMessage(err, navigator.language);
  if (friendly) return friendly;
  if (isPriceChangeUnseenError(err)) {
    return translate
      ? translate(PRICE_CHANGE_UNSEEN_KEY, PRICE_CHANGE_UNSEEN_TEXT)
      : PRICE_CHANGE_UNSEEN_TEXT;
  }
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

const DETAIL_STATUS_DEFAULTS: Record<string, string> = {
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.awaitingConfirmation': 'Awaiting confirmation',
  'rentals.phases.done': 'Done',
  'rentals.bookingStatus.awaiting_return': 'Return due',
  'rentalInspection.phase.reportReady': 'Report ready to review',
  'rentalInspection.phase.waitingRenter': 'Waiting for renter',
};

function BookingStatusStep({
  step,
  done,
  current,
  role,
}: {
  step: string;
  done: boolean;
  current: boolean;
  role: 'client' | 'business';
}) {
  const { t } = useTranslation();
  const labelKey = bookingDetailStepLabelKey(step, role);
  const accent = step === REPORT_REVIEW_STEP && role === 'business' ? '#0B7A3B' : '#0A4FB5';
  const color = done || current ? 'text.primary' : 'text.disabled';
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {current ? (
        <Lens sx={{ fontSize: 16, color: accent }} />
      ) : done ? (
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

function BookingStatusSteps({
  status,
  returnNote,
  noteColor,
  includeReview,
  reviewCurrent,
  role = 'client',
}: {
  status: string;
  returnNote?: string;
  noteColor?: string;
  includeReview?: boolean;
  reviewCurrent?: boolean;
  role?: 'client' | 'business';
}) {
  const { t } = useTranslation();
  const steps = bookingDetailTimeline(status, { includeReview });
  const current = bookingDetailTimelineIndex(steps, status, { reviewCurrent });
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
        <Box key={step}>
          <BookingStatusStep
            step={step}
            done={current > idx}
            current={doneCurrent(current, idx)}
            role={role}
          />
          {step === 'awaiting_return' && returnNote ? (
            <Typography variant="caption" sx={{ ml: 3.5, color: noteColor ?? '#0A4FB5', display: 'block' }}>
              {returnNote}
            </Typography>
          ) : null}
        </Box>
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
  const { flags, loaded: flagsLoaded } = useClientFlags();
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
    startRental,
    reportItemNotCollected,
    cancelBooking,
    initiatePickupPayment,
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
  const [info, setInfo] = useState<string | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  // Typed on the listing clock (like end_at); set when the return dialog opens.
  const [returnAtLocal, setReturnAtLocal] = useState('');
  const [returning, setReturning] = useState(false);
  const [earlyDialogOpen, setEarlyDialogOpen] = useState(false);
  const [earlyBusy, setEarlyBusy] = useState(false);
  const [sharingPin, setSharingPin] = useState(false);
  const [momoWaiting, setMomoWaiting] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [confirmView, setConfirmView] = useState<ConfirmView | null>(null);
  const inspection = useRentalInspection(bookingId, booking);
  const { hash } = useLocation();
  const loadedBookingId = booking?.id;
  useEffect(() => {
    if (hash !== '#rental-inspection' || !loadedBookingId || inspection.loading) return;
    document.getElementById('rental-inspection')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, loadedBookingId, inspection.loading]);
  const { unreadCount: unreadMessages, refresh: refreshUnreadMessages } =
    useRentalBookingUnreadCount(bookingId);
  const messagesSectionRef = useRef<HTMLDivElement | null>(null);
  const [messagesExpandSignal, setMessagesExpandSignal] = useState(0);

  const openMessages = useCallback(() => {
    setMessagesExpandSignal((n) => n + 1);
    messagesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
    if (!momoWaiting || !bookingId) return undefined;
    if (booking?.status === 'active' || booking?.actual_start_at) {
      setMomoWaiting(false);
      return undefined;
    }
    const timer = setInterval(() => {
      void fetchBookingDetail(bookingId).then((next) => {
        if (next) setBooking(next);
      }).catch(() => undefined);
    }, PAYMENT_POLL_MS);
    return () => clearInterval(timer);
  }, [booking?.actual_start_at, booking?.status, bookingId, fetchBookingDetail, momoWaiting]);

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

  const didntWindowOpen = useDidntReceiveWindow(true, booking?.actual_start_at);
  const reportedMissingItem = reportedNow || Boolean(booking?.not_received_report);
  useEffect(() => {
    setReportedNow(false);
    setWindowForcedClosed(false);
  }, [bookingId]);

  const isClient = profile?.client?.id === booking?.client_id;
  const isBusiness = profile?.business?.id === booking?.business_id;
  const showClientStart = isClient && inspection.gate.showRenterStart && !inspection.loading;
  const photosRequested = Boolean(isBusiness && inspection.pickup?.status === 'correction_requested');
  const showStartPanel = !photosRequested && (showClientStart || Boolean(isBusiness && (booking?.status === 'reserved' || booking?.status === 'confirmed' || booking?.status === 'active')));
  const showCollect = isBusiness && inspection.gate.showCollectPayment && !inspection.loading;
  const showReturnPicker =
    isBusiness &&
    inspection.showLegacyReturn &&
    !(
      flagsLoaded &&
      flags.rentals_renter_return_report_enabled &&
      booking?.renter_reported_returned_at
    );
  const paymentRail = paymentStatus?.payment_rail;
  const isStripePending =
    paymentRail === 'stripe' || (paymentRail == null && isStripeRail);
  const showPaymentPending = isClient && booking?.status === 'proposed';
  const hasStickyAction = showPaymentPending || showCollect || showReturnPicker || (isClient && showStartPanel);

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
  const listingCountry = booking.rental_location_listing?.business_location?.address?.country;
  const bookedSpan = formatBookedSpan(
    booking.start_at,
    booking.end_at,
    confirmationTimeZone(listingCountry, booking.currency),
    i18n.language,
    confirmationZoneDefault(listingCountry, booking.currency, i18n.language)
  );
  const periodLines = bookingDetailPeriodLines(
    selectionWindows,
    booking,
    i18n.language,
    dayCountLabel,
    bookedSpan
  );
  // Return due: return_due_at after an hourly early start, else the booked end.
  const returnDueAt = bookingReturnDue(booking) ?? booking.end_at;
  const returnPhase = renterReturnPhase({
    status: booking.status,
    endAt: returnDueAt,
    reportedAt: booking.renter_reported_returned_at,
    escalatedAt: booking.renter_return_escalated_at,
    timeZone: confirmationTimeZone(listingCountry, booking.currency),
  });
  const showReturnReport =
    Boolean(isClient) && flagsLoaded && flags.rentals_renter_return_report_enabled && returnPhase !== 'hidden';
  const showBusinessReport =
    Boolean(isBusiness) &&
    showBusinessReturnReport(
      flagsLoaded && flags.rentals_renter_return_report_enabled === true,
      status,
      booking.renter_reported_returned_at
    );
  const returnLocation = booking.return_place?.name || locationName;
  const returnByLabel = returnDueAt
    ? formatRentalPeriod(
        [{ start_at: returnDueAt, end_at: returnDueAt }],
        i18n.language,
        dayCountLabel
      )
    : '—';
  const confirmationsOn = flagsLoaded && flags.rentals_inspection_confirmations_enabled;
  const reviewReady =
    confirmationsOn &&
    inspection.enrolled &&
    reportReadyToReview({ status, pickup: inspection.pickup });
  const detailStatusKey = reviewReady
    ? bookingDetailStepLabelKey(REPORT_REVIEW_STEP, isBusiness ? 'business' : 'client')
    : bookingDetailStatusLabelKey(status, {
        returnReportedAt: isBusiness ? null : booking.renter_reported_returned_at,
      });
  const detailStatusLabel = t(
    detailStatusKey,
    DETAIL_STATUS_DEFAULTS[detailStatusKey] ?? status
  );
  const formatDetailMoney = (amount: number) => {
    const currency = booking.currency || 'XAF';
    if (currency.toUpperCase() === 'CAD') return formatConfirmationMoney(amount, 'CAD', i18n.language);
    return formatRequestAmount(amount, currency, i18n.language);
  };

  const listingZone = confirmationTimeZone(listingCountry, booking.currency);
  const windowPhase = pickupPhase({
    now: Date.now(),
    startAt: booking.start_at,
    endAt: booking.end_at,
    startOpensAt: booking.start_opens_at,
    timeZone: listingZone,
    started: status === 'active' || Boolean(booking.actual_start_at),
  });
  const windowLabel = windowStatusLabel({
    phase: windowPhase,
    photosAsked: photosRequested,
    day: formatZonedDay(booking.start_at, BOOKING_CLOCK, i18n.language),
    t,
  });

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

  const depositAmount = showsCardDeposit(booking.currency)
    ? Number(booking.security_deposit_amount) || 0
    : 0;
  const authorizedAmount = Number(booking.authorized_amount) || 0;
  const presentation = holdPresentation({
    total: Number(booking.total_amount) || 0,
    deposit: depositAmount,
    authorized: authorizedAmount,
  });
  const overtimeAmount = Number(booking.overtime_amount) || 0;

  // Early return (Samuel, 26 Nov): renter entry behind rentals_renter_return_report_enabled; no new flag.
  const renterReportFlag = flagsLoaded && flags.rentals_renter_return_report_enabled === true;
  const earlyOk =
    Boolean(isClient) &&
    canReturnEarly({ booking, timeZone: listingZone, flagOn: renterReportFlag, notReceived: reportedMissingItem });
  const earlyPending = earlyReportPending(booking, listingZone);
  const earlyDone = status === 'completed' && returnedEarly(booking, listingZone);
  const earlyJourney =
    earlyPending || earlyDone
      ? {
          aside: instantClock(returnInstantIso(booking), i18n.language, listingZone),
          sub: earlyPending
            ? isBusiness
              ? t('rentals.earlyReturn.waitingStepBusiness', 'Waiting for you to confirm')
              : t('rentals.earlyReturn.waitingStepRenter', 'Waiting for the business to confirm')
            : t('rentals.earlyReturn.bookedUntil', 'Booked until {{time}}', {
                time: bookedUntil(booking, i18n.language, listingZone),
              }),
        }
      : undefined;
  const priceLabel = formatDetailMoney(Number(booking.total_amount) || 0);
  const depositLabel = depositAmount > 0 ? formatDetailMoney(depositAmount) : '';
  const canItemReturned =
    Boolean(isBusiness) && status === 'active' && Boolean(booking.actual_start_at) && !booking.renter_reported_returned_at;
  const openEarlyConfirm = () => {
    if (inspection.enrolled && !inspection.showLegacyReturn) {
      document.getElementById('rental-inspection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setEarlyDialogOpen(true);
  };
  const submitEarlyReturn = async (actualEndAt: string) => {
    setEarlyBusy(true);
    setError(null);
    try {
      const res = await confirmReturn(bookingId, { actualEndAt });
      setEarlyDialogOpen(false);
      setInfo(
        res.overtimeDue
          ? t('rentals.earlyReturn.overtimePending', 'Return confirmed. Overtime payment in progress.')
          : t('rentals.earlyReturn.completed', 'Return confirmed. The rental is complete.')
      );
      void load();
    } catch (e: unknown) {
      setError(apiErrorMessage(e, t('rentals.earlyReturn.failed', 'Could not send. Check your connection and try again.'), t));
    } finally {
      setEarlyBusy(false);
    }
  };
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

  if (momoWaiting && booking) {
    return (
      <Box sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420 }}>
          <MobileMoneyConfirmIllustration />
          <Typography variant="h5" textAlign="center">{t('rentals.start.momoWaitingTitle', 'Approve on your phone')}</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t('rentals.start.momoWaitingBody', 'Approve the request on your phone. This page updates when the payment goes through.')}
          </Typography>
          <Typography variant="h6">{formatConfirmationMoney(Number(booking.accept_start_preview?.amount_due_at_pickup) || dueAtPickup(booking) || Number(booking.total_amount) || 0, booking.currency, i18n.language)}</Typography>
          <Typography>{booking.rental_location_listing?.rental_item?.name}</Typography>
          <Typography color="text.secondary">{booking.client?.user?.phone_number || ''}</Typography>
          <Button onClick={() => setMomoWaiting(false)}>{t('common.back', 'Back')}</Button>
        </Stack>
      </Box>
    );
  }

  if (confirmView) {
    return (
      <BookingConfirmation
        view={confirmView}
        booking={booking}
        language={i18n.language}
        canEdit={businessCanReplaceReport(
          confirmView.kind === 'sent' && confirmView.stage === 'return' ? inspection.returnView : inspection.pickup
        )}
        onBack={() => {
          setConfirmView(null);
          void inspection.reload();
          void load();
        }}
        onEdit={() => setConfirmView(null)}
      />
    );
  }

  return (
    <>
      <SEOHead title={title} />
      {isBusiness ? (
        <BusinessReturnConfirmDialog
          open={earlyDialogOpen}
          booking={{ ...booking, status }}
          timeZone={listingZone}
          zoneLabel={confirmationZoneDefault(listingCountry, booking.currency, i18n.language)}
          price={priceLabel}
          deposit={depositLabel}
          busy={earlyBusy}
          onClose={() => setEarlyDialogOpen(false)}
          onConfirm={(actualEndAt) => void submitEarlyReturn(actualEndAt)}
        />
      ) : null}
      <Box sx={{ minHeight: '100%', pb: hasStickyAction ? { xs: `${STICKY_ACTION_CLEARANCE + 72}px`, md: `${STICKY_ACTION_CLEARANCE}px` } : { xs: 10, md: 5 }, bgcolor: alpha(theme.palette.divider, 0.04) }}>
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 3 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Button onClick={() => navigate(-1)} sx={{ color: 'text.secondary' }}>
              {t('common.back', 'Back')}
            </Button>
            {bookingId && booking.status !== 'cancelled' ? (
              <RentalMessagesButton unreadCount={unreadMessages} onClick={openMessages} />
            ) : null}
          </Stack>

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
                    {t('rentals.bookingNumber', 'Booking:')} <strong>{booking.booking_number}</strong>
                  </Typography>
                ) : null}
                <Typography variant="body2" color="text.secondary">
                  {locationName}
                </Typography>
              </Stack>
            </Box>
            <Chip
              label={
                windowLabel
                  ? windowLabel
                  : reviewReady
                    ? detailStatusLabel
                    : status === 'awaiting_return'
                      ? t(detailStatusKey, 'Return due')
                      : status === 'reserved'
                        ? t('rentals.phases.reservedShort', 'Reserved')
                        : `${t('rentals.status', 'Status')}: ${t(`rentals.bookingStatus.${status}`, status)}`
              }
              color={reviewReady ? undefined : windowLabel ? (windowPhase === 'late' ? 'warning' : 'success') : statusChipColor}
              sx={{
                fontWeight: 800,
                ...(reviewReady
                  ? isBusiness
                    ? { bgcolor: '#B4530918', color: '#B45309' }
                    : { bgcolor: '#0A4FB518', color: '#0A4FB5' }
                  : {}),
              }}
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

          {showReturnReport || showBusinessReport || showStartPanel || photosRequested ? null : (
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
                ) : showCollect && inspection.enrolled && unpaidCancelMinutesLeft(booking.reserved_cancel_after) != null ? (
                  <Alert severity="warning">
                    {t('rentalInspection.autoCancel', 'Auto-cancel if unpaid: {{minutes}} min left. The clock started when Collect payment opened. Inspection time is not included.', {
                      minutes: unpaidCancelMinutesLeft(booking.reserved_cancel_after),
                    })}
                  </Alert>
                ) : null
              }
            />
          </Box>
          )}

          {booking.condition_declined_at && booking.condition_decline ? (
            <BusinessDeclineBanner
              reason={booking.condition_decline.reason}
              note={booking.condition_decline.reasonText}
              photos={booking.condition_decline.photos}
              timeZone={booking.currency === 'XAF' ? 'Africa/Douala' : 'America/Toronto'}
              bookingHref={bookingId ? `/rentals/bookings/${bookingId}` : undefined}
            />
          ) : null}
          {isClient && booking.condition_declined_at ? (
            <DeclineOutcomeCard
              money={{
                ...declineCardView(booking),
                timeZone: booking.currency === 'XAF' || booking.currency === 'XOF' ? 'Africa/Douala' : 'America/Toronto',
                place: '',
                item: booking.rental_location_listing?.rental_item?.name ?? '',
                bookingNumber: booking.booking_number ?? '',
              }}
              refundStatus={declineCardView(booking).refundStatus}
              onViewWallet={() => navigate('/accounts')}
              onBrowse={() => navigate('/rentals')}
              onContactSupport={() => navigate(`/support?booking=${encodeURIComponent(booking.booking_number ?? '')}`)}
            />
          ) : null}
          {bookingId && inspection.enrolled && !photosRequested ? (
            <Box id="rental-inspection">
              <RentalInspectionPanel
                bookingId={bookingId}
                role={isBusiness ? 'business' : 'client'}
                booking={booking}
                model={inspection}
                onChanged={() => void load()}
                confirmationsEnabled={confirmationsOn}
                onReportSent={(summary) => setConfirmView({ kind: 'sent', ...summary })}
                onRentalStarted={({ momo }) => setConfirmView({ kind: 'started', momo })}
              />
            </Box>
          ) : null}

          {earlyOk && bookingId ? (
            <RenterEarlyReturnPanel
              booking={{ ...booking, id: bookingId, status }}
              timeZone={listingZone}
              price={priceLabel}
              deposit={depositLabel}
              location={returnLocation}
              address={booking.return_place?.address ?? null}
              onReported={() => void load()}
            />
          ) : null}
          {earlyDone && isClient ? (
            <RenterReturnedEarlyCard
              booking={{ ...booking, status }}
              timeZone={listingZone}
              price={priceLabel}
              deposit={depositLabel}
              hold={depositLabel && authorizedAmount > 0 ? formatDetailMoney(authorizedAmount) : ''}
            />
          ) : null}
          {showReturnReport && bookingId ? (
            <RenterReturnPanel
              phase={returnPhase as Exclude<typeof returnPhase, 'hidden'>}
              bookingId={bookingId}
              location={returnLocation}
              address={booking.return_place?.address ?? returnLocation}
              phone={booking.return_place?.phone ?? null}
              endAt={returnDueAt}
              reportedAt={booking.renter_reported_returned_at}
              timeZone={listingZone}
              depositLabel={depositAmount > 0 ? formatDetailMoney(depositAmount) : ''}
              early={earlyPending}
              onChanged={() => void load()}
            />
          ) : null}
          {showBusinessReport && earlyPending ? (
            <BusinessEarlyReturnCard
              booking={{ ...booking, status }}
              timeZone={listingZone}
              deposit={depositLabel}
              onConfirm={openEarlyConfirm}
              onProblem={() => document.getElementById('rental-inspection')?.scrollIntoView({ behavior: 'smooth' })}
            />
          ) : null}
          {showBusinessReport && !earlyPending && booking.renter_reported_returned_at ? (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="business-return-report">
              <Typography fontWeight={700}>
                {t('rentals.returnReport.businessBanner', 'Renter says item returned · {{time}}', {
                  time: formatReturnStamp(booking.renter_reported_returned_at, i18n.language, listingZone),
                })}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t(
                  'rentals.returnReport.businessBody',
                  'Please check the item, then confirm the return. The {{amount}} deposit is released only after you confirm.',
                  { amount: formatDetailMoney(depositAmount) }
                )}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ minHeight: 48 }}
                  onClick={() => {
                    if (inspection.showLegacyReturn) {
                      setReturnAtLocal(listingDateTimeLocal(Date.now(), listingZone));
                      setReturnDialogOpen(true);
                      return;
                    }
                    document.getElementById('rental-inspection')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('rentals.returnReport.confirmReturn', 'Confirm return')}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ minHeight: 48 }}
                  onClick={() => document.getElementById('rental-inspection')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {t('rentals.returnReport.reportProblem', 'Report a problem')}
                </Button>
              </Stack>
            </Alert>
          ) : null}
          {!showReturnReport && !earlyOk && isClient &&
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
          !showStartPanel &&
          (reportedMissingItem || (didntWindowOpen && !windowForcedClosed && !booking.renter_reported_returned_at)) ? (
            <DidntReceiveReportButton
              bookingId={bookingId}
              startedAt={booking.actual_start_at}
              reported={reportedMissingItem}
              onReported={() => setReportedNow(true)}
              onWindowClosed={() => setWindowForcedClosed(true)}
            />
          ) : null}

          {isBusiness && status === 'active' && didntReceiveWindowOpen(booking.actual_start_at) ? (
            <RentalHandoverNotice
              mode="banner"
              renterName={[booking.client?.user?.first_name, booking.client?.user?.last_name].filter(Boolean).join(' ') || t('rentals.renter', 'The renter')}
              itemName={booking.rental_location_listing?.rental_item?.name ?? ''}
            />
          ) : null}
          {isClient && showsPayAtPickupCard(booking) ? (
            <PayAtPickupPanel
              booking={booking}
              format={(value) => formatConfirmationMoney(value, booking.currency, i18n.language)}
              itemCheck={inspection.enrolled}
              pickupDay={formatZonedWeekdayDay(booking.start_at, BOOKING_CLOCK, i18n.language)}
              timeZone={listingZone}
            />
          ) : null}
          {showStartPanel ? (
            <RentalStartPanel
              booking={booking}
              timeZone={confirmationTimeZone(booking.rental_location_listing?.business_location?.address?.country, booking.currency)}
              role={isBusiness ? 'business' : 'client'}
              renterName={[booking.client?.user?.first_name, booking.client?.user?.last_name].filter(Boolean).join(' ')}
              place={booking.rental_location_listing?.business_location?.name ?? ''}
              address={booking.return_place?.address}
              money={formatConfirmationMoney(Number(booking.accept_start_preview?.amount_due_at_pickup) || dueAtPickup(booking) || Number(booking.total_amount) || 0, booking.currency, i18n.language)}
              returnLabel={formatZonedWhen(returnDueAt, BOOKING_CLOCK, i18n.language, listingZone)}
              starting={sharingPin}
              actions={
                canItemReturned ? (
                  <BusinessItemReturnedActions
                    phone={booking.client?.user?.phone_number ?? null}
                    onItemReturned={openEarlyConfirm}
                  />
                ) : undefined
              }
              onNotCollected={isBusiness && status === 'active' && bookingId ? () => {
                void reportItemNotCollected(bookingId).then(() => {
                  setInfo(t('rentals.business.notCollectedSent', 'Support was notified that the item was not collected.'));
                }).catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
                });
              } : undefined}
              missing={
                isClient && bookingId && (reportedMissingItem || (didntWindowOpen && !windowForcedClosed && !booking.renter_reported_returned_at)) ? (
                  <DidntReceiveReportButton
                    bookingId={bookingId}
                    startedAt={booking.actual_start_at}
                    reported={reportedMissingItem}
                    onReported={() => setReportedNow(true)}
                    onWindowClosed={() => setWindowForcedClosed(true)}
                  />
                ) : undefined
              }
              onConfirm={() => {
                if (!bookingId) return;
                void startRental(bookingId).then((res) => {
                  if (res.checkout_url) {
                    // Card pay at pickup: Stripe Checkout for (rental − paid fee + deposit).
                    window.location.href = res.checkout_url;
                    return;
                  }
                  if (res.paymentPending) {
                    setMomoWaiting(true);
                    return;
                  }
                  void load();
                }).catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
                });
              }}
            />
          ) : null}
          {photosRequested && bookingId ? (
            <BusinessPhotoRequest
              bookingId={bookingId}
              renterName={booking.client?.user?.first_name || t('rentals.renter', 'The renter')}
              reason={inspection.pickup?.correctionReason}
              timeZone={listingZone}
              askedAt={inspection.pickup?.askedAt || inspection.pickup?.submittedAt}
              fixDay={formatZonedWeekdayDay(booking.start_at, BOOKING_CLOCK, i18n.language)}
              fee={reservationFee(booking) > 0 ? formatConfirmationMoney(reservationFee(booking), booking.currency, i18n.language) : undefined}
              photos={(inspection.pickup.units[0]?.photos ?? []).map((photo) => ({
                ...photo,
                unitId: inspection.pickup?.units[0]?.unitId ?? photo.id,
              }))}
              onSent={() => void inspection.reload()}
            />
          ) : null}

          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={900}>
                {t('rentals.status', 'Status')}
              </Typography>
              {(status === 'reserved' || status === 'confirmed' || status === 'active' || status === 'awaiting_return' || status === 'completed') ? (
                <RentalJourneyList
                  status={status}
                  payAtPickup={booking.payment_timing === 'pay_at_pickup' || booking.currency === 'XAF' || booking.currency === 'XOF'}
                  paid={booking.payment_status === 'paid' || booking.payment_status === 'authorized'}
                  paidAside={
                    (booking.payment_status === 'paid' || booking.payment_status === 'authorized') && (booking.paid_at || booking.created_at)
                      ? formatZonedDay(booking.paid_at || booking.created_at || '', listingZone, i18n.language)
                      : undefined
                  }
                  pickupAside={pickupClockLabel(booking.actual_start_at, booking.start_at, listingZone, i18n.language)}
                  early={earlyJourney}
                  accent="#0A4FB5"
                />
              ) : (
              <BookingStatusSteps
                status={status}
                includeReview={reviewReady}
                reviewCurrent={reviewReady}
                role={isBusiness ? 'business' : 'client'}
                noteColor={returnPhase === 'overdue' ? 'error.main' : '#0A4FB5'}
                returnNote={
                  returnPhase === 'waiting'
                    ? t('rentals.returnReport.waitingStepper', 'Waiting for confirmation')
                    : returnPhase === 'escalated'
                      ? t('rentals.returnReport.escalatedStepper', 'Support is checking')
                      : returnPhase === 'overdue'
                        ? t('rentals.returnReport.overdue', 'Overdue')
                        : undefined
                }
              />
              )}
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
                  <SummaryMoney
                    presentation={presentation}
                    business={Boolean(isBusiness)}
                    total={formatDetailMoney(Number(booking.total_amount) || 0)}
                    deposit={formatDetailMoney(depositAmount)}
                    held={formatDetailMoney(presentation.mode === 'sentence' ? presentation.amount : authorizedAmount)}
                  />
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
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

            {isBusiness && booking.merchant_earnings ? (
              <MerchantEarningsCard earnings={booking.merchant_earnings} />
            ) : null}

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
                  {t('business.rentals.clientDetails', 'Renter details')}
                </Typography>
                <Stack spacing={0.4}>
                  <Typography variant="body2">
                    <strong>{t('common.name', 'Name')}:</strong>{' '}
                    {renterName(booking) || '—'}
                  </Typography>
                  {renterPhone(booking) ? (
                    <Typography variant="body2">
                      <strong>{t('common.phone', 'Phone')}:</strong> {renterPhone(booking)}
                    </Typography>
                  ) : null}
                  {renterEmail(booking) ? (
                    <Typography variant="body2" color="text.secondary">
                      <strong>{t('common.email', 'Email')}:</strong> {renterEmail(booking)}
                    </Typography>
                  ) : null}
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
                    color="error"
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={() => void handleCancelBooking()}
                  >
                    {t('rentals.cancelBooking', 'Cancel booking')}
                  </Button>
                ) : null}

                {isBusiness && cancellableBeforeStart ? (
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={() => setCancelConfirm(true)}
                  >
                    {t('rentals.cancelBooking', 'Cancel booking')}
                  </Button>
                ) : null}

              </Paper>
            ) : null}

            <CancelBookingDialog
              open={cancelConfirm}
              fee={cancelFeeResult(booking, Date.now(), listingZone, inspection.pickup?.status === 'correction_requested')}
              feeLabel={formatConfirmationMoney(reservationFee(booking), booking.currency, i18n.language)}
              flagged={inspection.pickup?.status === 'correction_requested'}
              onClose={() => setCancelConfirm(false)}
              onConfirm={() => { setCancelConfirm(false); void handleCancelBooking(); }}
            />

            {bookingId && booking.status !== 'cancelled' ? (
              <Box id="rental-messages" ref={messagesSectionRef}>
              <UserMessagesComponent
                entityType="rental_booking"
                entityId={bookingId}
                title={t('rentals.messages.title', 'Messages')}
                defaultExpanded={messagesDefaultExpanded(booking.status)}
                expandSignal={messagesExpandSignal}
                onMessagesRead={() => void refreshUnreadMessages()}
                maxVisibleMessages={5}
              />
              </Box>
            ) : null}
          </Stack>
        </Container>
      </Box>

      {showPaymentPending ? (
        <StickyActionCard
          testId="rental-booking-sticky"
          actionColor="cta"
          summaryLabel={t('rentals.bookingDetail.stickyTotal', 'Total')}
          summaryValue={formatConfirmationMoney(Number(booking.total_amount) || 0, booking.currency, i18n.language)}
          actionLabel={t('rentals.actions.completePayment', 'Complete payment')}
          disabled={retryingPayment}
          onAction={() => void handleRetryPayment()}
        />
      ) : showCollect ? (
        <StickyActionCard
          testId="rental-booking-sticky"
          summaryLabel={t('rentals.payAtPickup.dueAfterCheck', 'Due at pickup, after the item check')}
          summaryValue={formatConfirmationMoney(dueAtPickup(booking) || Number(booking.total_amount) || 0, booking.currency, i18n.language)}
          actionLabel={t('rentals.actions.collectPayment', 'Collect payment')}
          onAction={() => void handlePickupPayment()}
        />
      ) : showReturnPicker ? (
        <StickyActionCard
          testId="rental-booking-sticky"
          actionColor="success"
          actionLabel={t('rentals.actions.confirmReturn', 'Confirm return')}
          onAction={() => {
            setReturnAtLocal(listingDateTimeLocal(Date.now(), listingZone));
            setReturnDialogOpen(true);
          }}
        />
      ) : null}

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
                const actualEndAt = dateTimeLocalToInstantIso(returnAtLocal, listingZone);
                if (!actualEndAt) {
                  setError(t('rentals.returnAtInvalid', 'Enter a valid return date and time'));
                  return;
                }
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

type ConfirmView =
  | {
      kind: 'sent';
      stage: 'pickup' | 'return';
      versionNo: number;
      submittedAt: string;
      unitCount: number;
      photos: Array<{ id: string; role: string; url?: string }>;
    }
  | { kind: 'started'; momo: boolean };

function BookingConfirmation({
  view,
  booking,
  language,
  canEdit,
  onBack,
  onEdit,
}: {
  view: ConfirmView;
  booking: RentalBookingDetail;
  language: string;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const country = booking.rental_location_listing?.business_location?.address?.country;
  const zoneId = confirmationTimeZone(country, booking.currency);
  const due = formatConfirmationDue(bookingReturnDue(booking) ?? booking.end_at, 'UTC', language);
  const zone = t(
    confirmationZoneKey(country, booking.currency),
    confirmationZoneDefault(country, booking.currency, language)
  );
  return (
    <Box sx={{ minHeight: '100%', pb: 5, bgcolor: alpha(theme.palette.divider, 0.04) }}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {view.kind === 'sent' ? (
          <ReportSentConfirmation
            stage={view.stage}
            renterName={booking.client?.user?.first_name || t('rentals.client', 'the renter')}
            unitCount={view.unitCount}
            versionNo={view.versionNo}
            when={formatConfirmationDue(view.submittedAt, zoneId, language)}
            photos={view.photos}
            canEdit={canEdit}
            onBack={onBack}
            onEdit={onEdit}
          />
        ) : (
          <RentalStartedConfirmation
            momo={view.momo}
            due={due}
            zone={zone}
            paid={formatConfirmationMoney(Number(booking.total_amount) || 0, booking.currency, language)}
            deposit={depositLabel(booking, language)}
            depositHeld={confirmationDepositHeld(booking.payment_status)}
            title={booking.rental_location_listing?.rental_item?.name || 'Rental'}
            startAt={booking.start_at}
            endAt={bookingReturnDue(booking) ?? booking.end_at}
            location={booking.rental_location_listing?.business_location?.name}
            onBack={onBack}
          />
        )}
      </Container>
    </Box>
  );
}

function renterName(booking: RentalBookingDetail): string {
  const user = booking.client?.user;
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
}

function renterPhone(booking: RentalBookingDetail): string {
  return booking.client?.user?.phone_number?.trim() ?? '';
}

function renterEmail(booking: RentalBookingDetail): string {
  return booking.client?.user?.email?.trim() ?? '';
}

function SummaryMoney(props: {
  presentation: HoldPresentation;
  business: boolean;
  total: string;
  deposit: string;
  held: string;
}) {
  if (props.presentation.mode === 'sentence') {
    return <HeldSentence business={props.business} held={props.held} />;
  }
  if (props.presentation.mode === 'split') {
    return <HeldWithParts business={props.business} held={props.held} total={props.total} deposit={props.deposit} />;
  }
  return <QuotedTotal total={props.total} />;
}

function HeldSentence({ business, held }: { business: boolean; held: string }) {
  const { t } = useTranslation();
  const key = business ? 'rentals.bookingDetail.heldOnRenterCard' : 'rentals.start.held';
  const fallback = business ? "{{amount}} held on the renter's card" : '{{amount}} held on your card';
  return (
    <Typography variant="h6" fontWeight={800} color="success.dark">
      {t(key, fallback, { amount: held })}
    </Typography>
  );
}

/** Card hold that is rental + deposit: the held total first, then the two parts in grey. */
function HeldWithParts(props: { business: boolean; held: string; total: string; deposit: string }) {
  const { t } = useTranslation();
  return (
    <Box data-testid="booking-held-split">
      <HeldSentence business={props.business} held={props.held} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('rentals.start.heldSplit', '{{rental}} rental · {{deposit}} security deposit', {
          rental: props.total,
          deposit: props.deposit,
        })}
      </Typography>
    </Box>
  );
}

function QuotedTotal({ total }: { total: string }) {
  const { t } = useTranslation();
  return (
    <>
      <Typography variant="caption" color="text.secondary" display="block">
        {t('rentals.clientRequests.bookConfirmLabelTotal', 'Quoted total')}
      </Typography>
      <Typography variant="h5" fontWeight={900} color="success.dark">{total}</Typography>
    </>
  );
}

function depositLabel(booking: RentalBookingDetail, language: string): string {
  if (!showsCardDeposit(booking.currency)) return '';
  const amount = Number(booking.security_deposit_amount) || 0;
  const lines = cardHoldLines({
    total: Number(booking.total_amount) || 0,
    deposit: amount,
    authorized: Number(booking.authorized_amount) || 0,
  });
  if (!lines.showDeposit) return '';
  return formatConfirmationMoney(amount, booking.currency, language);
}

