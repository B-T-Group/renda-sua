import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { StatusPill } from '../../components/common/StatusPill';
import { OrderMessageComposer } from '../../components/messaging/OrderMessageComposer';
import {
  DidntReceiveReportButton,
  useDidntReceiveWindow,
} from '../../components/rentals/DidntReceiveReportButton';
import { DeclineOutcomeCard, declineCardView } from '../../components/rentals/DeclinePickupScreens';
import { RentalPhaseBanner } from '../../components/rentals/RentalPhaseBanner';
import { RentalStartCard } from '../../components/rentals/RentalStartCard';
import { RentalJourneyList } from '../../components/rentals/RentalJourneyList';
import { RenterReturnCard } from '../../components/rentals/RenterReturnCard';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalBookingDetail } from '../../hooks/useRentalBookingDetail';
import { useInspectionSnapshot } from '../../hooks/useInspectionSnapshot';
import { useRentalBookingMessages } from '../../hooks/useRentalBookingMessages';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { cardHoldLines, holdCopyFallback, holdCopyKey, showsCardDeposit } from '../../utils/rentals/cardDeposit';
import {
  settlePickupCardPayment,
  settleRentalStripePayment,
  useRentalStripePayment,
} from '../../hooks/useRentalStripePayment';
import { PayAtPickupCard } from '../../components/rentals/PayAtPickupCard';
import { cancelFeeResult, cardDueAtPickup, dueAtPickup, reservationFee, showsPayAtPickupCard } from '../../utils/rentals/reservationFee';
import { CancelBookingDialog } from '../../components/rentals/CancelBookingDialog';
import type { ClientRootStackParamList } from '../../navigation/types';
import {
  REPORT_REVIEW_STEP,
  bookingDetailStatusLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  formatRentalMoney,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  rentalBookingStatusColors,
} from '../../utils/rentals';
import {
  bookingDetailPeriodLines,
  formatListingDeadline,
  formatRequestAmount,
} from '../../utils/rentals/rentalRequestFormat';
import { clientInspectionAction, pickupGate, reportReadyToReview } from '../../utils/rentals/rentalInspection';
import {
  confirmationTimeZone,
  confirmationZoneDefault,
  formatBookedSpan,
  formatConfirmationMoney,
} from '../../utils/rentals/confirmationFormat';
import { renterReturnPhase } from '../../utils/rentals/renterReturnPhase';
import {
  bookedUntil,
  canReturnEarly,
  earlyReportPending,
  instantClock,
  returnInstantIso,
  returnedEarly,
} from '../../utils/rentals/earlyReturn';
import { RenterEarlyReturn } from '../../components/rentals/RenterEarlyReturn';
import { RenterReturnedEarlyCard } from '../../components/rentals/RenterReturnedEarlyCard';
import {
  isPriceChangeUnseenError,
  PRICE_CHANGE_UNSEEN_KEY,
  PRICE_CHANGE_UNSEEN_TEXT,
} from '../../utils/rentals/priceChangeUnseen';
import { BOOKING_CLOCK, formatZonedDay, formatZonedWeekdayDay, formatZonedWhen, pickupClockLabel, pickupPhase } from '../../utils/rentals/rentalStartWindow';
import { bookingReturnDue } from '../../utils/rentals/returnDue';
import { RentalMomoWaiting } from '../../components/rentals/RentalMomoWaiting';
import { BookingQuickActions } from '../../components/rentals/BookingQuickActions';
import { maskPhoneE164 } from '../../utils/maskPhoneE164';

type Params = { RentalBookingDetail: { bookingId: string } };

const DETAIL_STATUS_DEFAULTS: Record<string, string> = {
  'rentals.phases.requested': 'Requested',
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.done': 'Done',
  'rentals.bookingStatus.awaiting_return': 'Return due',
  'rentalInspection.phase.reportReady': 'Report ready to review',
  'rentalInspection.phase.waitingRenter': 'Waiting for renter',
};

function toAmount(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function RentalBookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { flags, loading: flagsLoading } = useClientFlags();
  const scrollRef = useRef<ScrollView>(null);
  const messagesY = useRef(0);
  const route = useRoute<RouteProp<Params, 'RentalBookingDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const bookingId = route.params?.bookingId;
  const {
    booking,
    paymentStatus,
    loading,
    error,
    actionLoading,
    refetch,
    cancel,
    retryPayment,
    startRental,
  } = useRentalBookingDetail(bookingId);
  const {
    isStripeRail,
    loading: stripeRailLoading,
    refetch: refetchStripeRail,
  } = useIsStripeRail();
  const { pay: payWithSheet, loading: sheetLoading } = useRentalStripePayment();
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    refetch: refetchMessages,
    mentionableParticipants,
    markMessagesRead,
  } = useRentalBookingMessages(bookingId ?? '');

  const [reportedNow, setReportedNow] = useState(false);
  const [windowForcedClosed, setWindowForcedClosed] = useState(false);
  const didntWindowOpen = useDidntReceiveWindow(true, booking?.actual_start_at);
  const reportedMissingItem = reportedNow || Boolean(booking?.not_received_report);
  useEffect(() => {
    setReportedNow(false);
    setWindowForcedClosed(false);
  }, [bookingId]);

  const [startOpen, setStartOpen] = useState(false);
  const [momoWaiting, setMomoWaiting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchMessages()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMessages]);

  const formatMessageDate = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }, []);

  const statusColorsBase = rentalBookingStatusColors(booking?.status ?? '', colors);
  const statusLabelKeyBase = bookingDetailStatusLabelKey(booking?.status ?? '');
  const statusLabelBase = t(
    statusLabelKeyBase,
    DETAIL_STATUS_DEFAULTS[statusLabelKeyBase] ?? booking?.status ?? ''
  );
  const pricing = parseRentalPricingSnapshot(booking?.rental_pricing_snapshot);
  const moneyCurrency = pricing?.currency ?? booking?.currency ?? 'XAF';
  const formatDetailMoney = (amount: number) => {
    if (moneyCurrency.toUpperCase() === 'CAD') return formatConfirmationMoney(amount, 'CAD', i18n.language);
    return formatRequestAmount(amount, moneyCurrency, i18n.language);
  };
  const windows = parseRentalSelectionWindows(
    booking?.rental_request?.rental_selection_windows
  );
  const dayCountLabel = (count: number) =>
    t('rentals.requestForm.dayCount', '{{count}} day', { count });
  const listingCountry = booking?.rental_location_listing?.business_location?.address?.country;
  const bookedSpan = formatBookedSpan(
    booking?.start_at,
    booking?.end_at,
    confirmationTimeZone(listingCountry, booking?.currency),
    i18n.language,
    confirmationZoneDefault(listingCountry, booking?.currency, i18n.language)
  );
  const periodLines = bookingDetailPeriodLines(
    windows,
    booking,
    i18n.language,
    dayCountLabel,
    bookedSpan
  );
  // Return due: return_due_at after an hourly early start, else the booked end.
  const returnDueAt = bookingReturnDue(booking);
  const returnByLabel = returnDueAt
    ? formatZonedWhen(returnDueAt, BOOKING_CLOCK, i18n.language, confirmationTimeZone(listingCountry, booking?.currency))
    : '—';
  const timelineStepsBase = bookingDetailTimeline(booking?.status ?? '');
  const currentIdxBase = bookingDetailTimelineIndex(timelineStepsBase, booking?.status ?? '');
  const canCancel =
    (booking?.status === 'confirmed' || booking?.status === 'reserved') &&
    !booking?.actual_start_at;
  const snapshot = useInspectionSnapshot(bookingId ?? '', booking);
  const confirmationsOn = !flagsLoading && flags.rentals_inspection_confirmations_enabled;
  const reviewReady =
    confirmationsOn &&
    snapshot.enrolled &&
    reportReadyToReview({ status: booking?.status, pickup: snapshot.pickup });
  const statusColors = reviewReady
    ? { backgroundColor: '#0A4FB518', textColor: '#0A4FB5', borderColor: '#0A4FB544' }
    : statusColorsBase;
  const statusLabelKey = reviewReady
    ? bookingDetailStatusLabelKey(REPORT_REVIEW_STEP)
    : statusLabelKeyBase;
  const statusLabel = reviewReady
    ? t(statusLabelKey, DETAIL_STATUS_DEFAULTS[statusLabelKey] ?? 'Report ready to review')
    : statusLabelBase;
  const timelineSteps = reviewReady
    ? bookingDetailTimeline(booking?.status ?? '', { includeReview: true })
    : timelineStepsBase;
  const currentIdx = reviewReady
    ? bookingDetailTimelineIndex(timelineSteps, booking?.status ?? '', { reviewCurrent: true })
    : currentIdxBase;
  useFocusEffect(
    useCallback(() => {
      if (!confirmationsOn) return undefined;
      void refetch();
      void snapshot.reload();
      return undefined;
    }, [confirmationsOn, refetch, snapshot.reload])
  );
  const gate = pickupGate({
    enrolled: snapshot.enrolled,
    status: booking?.status ?? '',
    submitted: snapshot.pickup?.status === 'submitted' && !snapshot.pickup.yourDecision,
    accepted: snapshot.pickup?.yourDecision === 'accept',
  });
  const reviewAction = clientInspectionAction({
    status: booking?.status ?? '',
    pickup: snapshot.pickup,
    returnView: snapshot.returnView,
  });
  const reviewStage =
    reviewAction === 'review_pickup' ? 'pickup' : reviewAction === 'review_return' ? 'return' : null;
  const isReserved = booking?.status === 'reserved';
  const depositAmount = showsCardDeposit(booking?.currency)
    ? toAmount(booking?.security_deposit_amount)
    : 0;
  const authorizedAmount = toAmount(booking?.authorized_amount);
  const hold = cardHoldLines({
    total: toAmount(booking?.total_amount),
    deposit: depositAmount,
    authorized: authorizedAmount,
  });
  const overtimeAmount = toAmount(booking?.overtime_amount);
  const returnPhase = renterReturnPhase({
    status: booking?.status ?? '',
    endAt: returnDueAt,
    reportedAt: booking?.renter_reported_returned_at,
    escalatedAt: booking?.renter_return_escalated_at,
    timeZone: booking ? confirmationTimeZone(listingCountry, booking.currency) : null,
  });
  const showReturnReport = !flagsLoading && flags.rentals_renter_return_report_enabled && returnPhase !== 'hidden';
  const headerOverdue = showReturnReport && returnPhase === 'overdue';
  const startZone = booking
    ? confirmationTimeZone(booking.rental_location_listing?.business_location?.address?.country, booking.currency)
    : 'Africa/Douala';
  const startPhase = booking && (booking.status === 'reserved' || booking.status === 'confirmed')
    ? pickupPhase({
        now: Date.now(),
        startAt: booking.start_at,
        endAt: booking.end_at,
        startOpensAt: booking.start_opens_at,
        timeZone: startZone,
      })
    : null;
  // Weekday dates (S6): "Sat 28 Nov" / "sam. 28 nov.".
  const pickupDay = booking ? formatZonedWeekdayDay(booking.start_at, BOOKING_CLOCK, i18n.language) : '';
  const pickupFlagged = snapshot.pickup?.status === 'correction_requested';
  const cancelFee = booking ? cancelFeeResult(booking, Date.now(), startZone, pickupFlagged) : 'none';
  const paidSource = booking?.paid_at || booking?.created_at;
  const paidAside = paidSource && (booking?.payment_status === 'paid' || booking?.payment_status === 'authorized')
    ? formatZonedDay(paidSource, startZone, i18n.language)
    : undefined;
  const pickupAside = booking
    ? pickupClockLabel(booking.actual_start_at, booking.start_at, startZone, i18n.language)
    : undefined;
  const pillLabel = headerOverdue
    ? t('rentals.returnReport.overdue', 'Overdue')
    : startPhase === 'before' && showsPayAtPickupCard(booking)
      ? t('rentals.payAtPickup.pill', 'Reserved · pay at pickup')
      : startPhase === 'before'
      ? t('rentals.start.pillDay', 'Pickup {{day}}', { day: pickupDay })
      : startPhase === 'today'
        ? t('rentals.start.pickupToday', 'Pickup today')
        : startPhase === 'late'
          ? t('rentals.start.latePickup', 'Late pickup')
          : statusLabel;
  const phaseTone = startPhase === 'late' ? colors.warning : startPhase === 'today' || startPhase === 'before' ? colors.success : null;
  const pillColors = headerOverdue
    ? {
        backgroundColor: colors.error.main + '18',
        textColor: colors.error.main,
        borderColor: colors.error.main + '44',
      }
    : phaseTone
      ? {
          backgroundColor: phaseTone.main + '18',
          textColor: phaseTone.dark ?? phaseTone.main,
          borderColor: phaseTone.main + '44',
        }
      : statusColors;
  const returnLocation =
    booking?.return_place?.name ||
    booking?.rental_location_listing?.business_location?.name ||
    '—';
  const earlyOk = booking
    ? canReturnEarly({
        booking,
        timeZone: startZone,
        flagOn: !flagsLoading && flags.rentals_renter_return_report_enabled === true,
        notReceived: reportedMissingItem,
      })
    : false;
  const earlyPending = booking ? earlyReportPending(booking, startZone) : false;
  const earlyDone = booking?.status === 'completed' && returnedEarly(booking, startZone);
  const earlyJourney = booking && (earlyPending || earlyDone)
    ? {
        aside: instantClock(returnInstantIso(booking), i18n.language, startZone),
        sub: earlyPending
          ? t('rentals.earlyReturn.waitingStepRenter', 'Waiting for the business to confirm')
          : t('rentals.earlyReturn.bookedUntil', 'Booked until {{time}}', { time: bookedUntil(booking, i18n.language, startZone) }),
      }
    : undefined;
  const isPayAtPickup = booking?.payment_timing === 'pay_at_pickup';
  const paymentPending =
    booking?.status === 'proposed' &&
    (paymentStatus?.paymentPending ?? true);
  const isStripePending =
    paymentStatus?.payment_rail === 'stripe' ||
    (paymentStatus?.payment_rail == null && isStripeRail);

  const bookingImages =
    booking?.rental_location_listing?.rental_item?.rental_item_images ?? [];
  const imageUri = bookingImages[0]?.image_url;

  const cardAtPickup = cardDueAtPickup(booking);
  const onStartRental = useCallback(async () => {
    try {
      const res = await startRental(cardAtPickup ? { stripe_payment_method: 'payment_sheet' } : undefined);
      setStartOpen(false);
      if (!cardAtPickup) {
        if (res.paymentPending) setMomoWaiting(true);
        return;
      }
      const outcome = await settlePickupCardPayment(res, payWithSheet);
      if (outcome === 'cancelled') {
        setSnack(t('rentals.payAtPickup.cardCancelled', 'Payment cancelled. Nothing was charged. You can try again.'));
      } else if (outcome === 'failed') {
        setSnack(t('rentals.payAtPickup.cardFailed', 'Card payment didn’t go through. Try again or use another card.'));
      } else if (outcome !== 'none') {
        setSnack(t('rentals.payAtPickup.cardConfirming', 'Payment received. Starting your rental…'));
        void refetch();
      }
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    }
  }, [cardAtPickup, payWithSheet, refetch, startRental, t]);

  const onRetry = useCallback(async () => {
    try {
      let usePaymentSheet =
        paymentStatus?.payment_rail === 'stripe' || isStripeRail;
      if (paymentStatus?.payment_rail === 'mobile_money') {
        usePaymentSheet = false;
      } else if (!usePaymentSheet && stripeRailLoading) {
        usePaymentSheet = await refetchStripeRail();
      }
      const res = await retryPayment(
        usePaymentSheet ? { stripe_payment_method: 'payment_sheet' } : undefined
      );
      const stripeOutcome = await settleRentalStripePayment(res, payWithSheet);
      if (res.confirmed || stripeOutcome === 'success' || stripeOutcome === 'authorized') {
        setSnack(t('client.rentals.paymentConfirmed', 'Payment confirmed'));
        void refetch();
        return;
      }
      if (stripeOutcome === 'cancelled') {
        setSnack(
          t('client.rentals.paymentCancelled', 'Payment cancelled. You can retry from the booking.')
        );
        return;
      }
      if (stripeOutcome === 'failed') {
        setSnack(t('client.rentals.paymentFailed', 'Payment failed. You can retry from the booking.'));
        return;
      }
      if (stripeOutcome === 'pending') {
        setSnack(
          t(
            'client.rentals.paymentConfirming',
            'Payment received. Confirming your booking…'
          )
        );
        void refetch();
        return;
      }
      if (stripeOutcome === 'browser' || isStripePending) {
        setSnack(
          t(
            'client.rentals.paymentPendingStripe',
            'Complete card payment to confirm your booking.'
          )
        );
        return;
      }
      setSnack(
        t(
          'client.rentals.paymentInitiated',
          'Payment request sent. Confirm on your phone if prompted.'
        )
      );
    } catch (e: unknown) {
      setSnack(
        isPriceChangeUnseenError(e)
          ? t(PRICE_CHANGE_UNSEEN_KEY, PRICE_CHANGE_UNSEEN_TEXT)
          : e instanceof Error
            ? e.message
            : t('rentals.requestFailed', 'Request failed')
      );
    }
  }, [
    isStripePending,
    isStripeRail,
    payWithSheet,
    paymentStatus?.payment_rail,
    refetch,
    refetchStripeRail,
    retryPayment,
    stripeRailLoading,
    t,
  ]);

  const onCancel = useCallback(async () => {
    try {
      await cancel();
      setCancelOpen(false);
      setSnack(t('rentals.cancelled', 'Booking cancelled'));
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    }
  }, [cancel, t]);

  const title = useMemo(
    () =>
      booking?.rental_location_listing?.rental_item?.name ??
      t('rentals.clientRequests.unknownItem', 'Rental'),
    [booking, t]
  );

  useEffect(() => {
    if (!momoWaiting) return undefined;
    if (booking?.status === 'active' || booking?.actual_start_at) {
      setMomoWaiting(false);
      return undefined;
    }
    const timer = setInterval(() => void refetch(), 4000);
    return () => clearInterval(timer);
  }, [booking?.actual_start_at, booking?.status, momoWaiting, refetch]);

  if (momoWaiting) {
    return (
      <RentalMomoWaiting
        amount={formatConfirmationMoney(
          Number(booking?.accept_start_preview?.amount_due_at_pickup) || dueAtPickup(booking) || Number(booking?.total_amount) || 0,
          booking?.currency || 'XAF',
          i18n.language
        )}
        item={booking?.rental_location_listing?.rental_item?.name ?? ''}
        phone={maskPhoneE164(booking?.client?.user?.phone_number || '')}
        onBack={() => setMomoWaiting(false)}
      />
    );
  }

  if (loading && !booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { padding: spacing.lg, backgroundColor: colors.pageBackground }]}>
        <Text style={[typography.h6, { color: colors.text.primary, textAlign: 'center' }]}>
          {error || t('rentals.bookingNotFound', 'Booking not found')}
        </Text>
        <Button mode="contained" style={{ marginTop: spacing.md }} onPress={() => void refetch()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + (paymentPending || reviewStage ? 120 : spacing.xl + 32),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
      >
        {imageUri ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t(
              'public.items.detail.viewFullImage',
              'View full image'
            )}
            onPress={() => {
              setLightboxIdx(0);
              setLightboxOpen(true);
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={[styles.hero, { borderRadius: borderRadius.md }]}
              resizeMode="cover"
            />
          </Pressable>
        ) : null}

        <View style={[styles.headerRow, { marginTop: spacing.md }]}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
            <Text style={[typography.h5, { color: colors.text.primary }]}>{title}</Text>
            {booking.booking_number ? (
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {booking.booking_number}
              </Text>
            ) : null}
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {booking.rental_location_listing?.business_location?.name ?? ''}
            </Text>
          </View>
          <StatusPill
            label={pillLabel}
            backgroundColor={pillColors.backgroundColor}
            textColor={pillColors.textColor}
            borderColor={pillColors.borderColor}
          />
        </View>

        {booking.condition_declined_at ? (
          <DeclineOutcomeCard
            money={{
              ...declineCardView(booking),
              timeZone: booking.currency === 'XAF' || booking.currency === 'XOF' ? 'Africa/Douala' : 'America/Toronto',
              place: booking.rental_location_listing?.business_location?.name ?? '',
              item: booking.rental_location_listing?.rental_item?.name ?? '',
              bookingNumber: booking.booking_number ?? '',
            }}
            refundStatus={declineCardView(booking).refundStatus}
            onViewWallet={() => navigation.navigate('ClientAccounts')}
            onBrowse={() => navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse', params: { segment: 'rentals' } })}
            onContactSupport={() => navigation.navigate('SupportTickets', { bookingNumber: booking.booking_number ?? '' })}
          />
        ) : null}

        {showReturnReport || booking.status === 'reserved' || booking.status === 'confirmed' || booking.status === 'active' ? null : (
        <View style={{ marginTop: spacing.md }}>
          <RentalPhaseBanner
            bookingStatus={booking.status}
            chipLabel={statusLabel}
            role="client"
            nextStepKey={
              snapshot.enrolled &&
              (booking.status === 'reserved' || booking.status === 'confirmed')
                ? 'rentalInspection.bannerReview'
                : undefined
            }
            action={
              paymentPending ? (
                <Button
                  mode="contained"
                  loading={actionLoading || sheetLoading}
                  onPress={() => void onRetry()}
                  style={{ marginTop: spacing.xs }}
                >
                  {t('rentals.actions.completePayment', 'Complete payment')}
                </Button>
              ) : booking.status === 'completed' ? (
                <Button
                  mode="contained"
                  style={{ marginTop: spacing.xs }}
                  onPress={() =>
                    navigation.navigate('RentalRateBooking', { bookingId: booking.id })
                  }
                >
                  {t('rentals.actions.rate', 'Rate rental')}
                </Button>
              ) : null
            }
          />
        </View>
        )}

        {showsPayAtPickupCard(booking) && !showReturnReport ? (
          <View style={{ marginTop: spacing.md }}>
            <PayAtPickupCard
              booking={booking}
              format={formatDetailMoney}
              itemCheck={snapshot.enrolled}
              pickupDay={pickupDay}
              timeZone={confirmationTimeZone(listingCountry, booking.currency)}
            />
          </View>
        ) : null}

        {(booking.status === 'reserved' || booking.status === 'confirmed' || booking.status === 'active') && !showReturnReport ? (
          <View style={{ marginTop: spacing.md }}>
            <RentalStartCard
              booking={booking}
              timeZone={confirmationTimeZone(
                booking.rental_location_listing?.business_location?.address?.country,
                booking.currency
              )}
              role="client"
              place={booking.rental_location_listing?.business_location?.name ?? ''}
              money={formatConfirmationMoney(
                Number(booking.accept_start_preview?.amount_due_at_pickup) || dueAtPickup(booking) || Number(booking.total_amount) || 0,
                booking.currency,
                i18n.language
              )}
              returnLabel={returnByLabel}
              starting={actionLoading}
              open={startOpen}
              onOpen={() => setStartOpen(true)}
              onClose={() => setStartOpen(false)}
              onConfirm={() => void onStartRental()}
              actions={
                earlyOk ? (
                  <RenterEarlyReturn
                    booking={booking}
                    timeZone={startZone}
                    price={formatConfirmationMoney(Number(booking.total_amount) || 0, booking.currency, i18n.language)}
                    deposit={hold.showDeposit ? formatConfirmationMoney(depositAmount, booking.currency, i18n.language) : ''}
                    location={returnLocation}
                    address={booking.return_place?.address ?? null}
                    onMessage={() => scrollRef.current?.scrollTo({ y: messagesY.current, animated: true })}
                    onReported={() => void refetch()}
                    onAlreadyConfirmed={() => void refetch()}
                  />
                ) : undefined
              }
              missing={
                reportedMissingItem || (didntWindowOpen && !windowForcedClosed && !booking.renter_reported_returned_at) ? (
                  <DidntReceiveReportButton
                    bookingId={booking.id}
                    startedAt={booking.actual_start_at}
                    reported={reportedMissingItem}
                    onReported={() => setReportedNow(true)}
                    onWindowClosed={() => setWindowForcedClosed(true)}
                  />
                ) : undefined
              }
            />
          </View>
        ) : null}

        {snapshot.enrolled && !confirmationsOn ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {reviewStage ? (
              <Button
                mode="contained"
                buttonColor={colors.primary.main}
                style={{ minHeight: 48 }}
                onPress={() =>
                  navigation.navigate('ClientInspection', {
                    bookingId: booking.id,
                    stage: reviewStage,
                  })
                }
              >
                {reviewStage === 'pickup'
                  ? snapshot.pickup?.yourDecision === 'accept'
                    ? t('rentalInspection.acceptAndStart', 'Accept condition & start rental')
                    : t('rentalInspection.reviewTitle', 'Review item condition')
                  : t('rentalInspection.returnReview', 'Review the return against pickup photos')}
              </Button>
            ) : null}
          </View>
        ) : null}

        {showReturnReport && booking ? (
          <RenterReturnCard
            phase={returnPhase as Exclude<typeof returnPhase, 'hidden'>}
            bookingId={booking.id}
            location={returnLocation}
            address={booking.return_place?.address ?? returnLocation}
            phone={booking.return_place?.phone ?? null}
            endAt={returnDueAt ?? booking.end_at}
            reportedAt={booking.renter_reported_returned_at}
            timeZone={startZone}
            depositLabel={hold.showDeposit ? formatDetailMoney(depositAmount) : ''}
            early={earlyPending}
            onReported={() => void refetch()}
            onAlreadyConfirmed={() => void refetch()}
            onMessage={() => scrollRef.current?.scrollTo({ y: messagesY.current, animated: true })}
          />
        ) : null}
        {earlyDone ? (
          <RenterReturnedEarlyCard
            booking={booking}
            timeZone={startZone}
            price={formatConfirmationMoney(Number(booking.total_amount) || 0, booking.currency, i18n.language)}
            deposit={showsCardDeposit(booking.currency) && depositAmount > 0 ? formatConfirmationMoney(depositAmount, booking.currency, i18n.language) : ''}
            hold={authorizedAmount > 0 ? formatConfirmationMoney(authorizedAmount, booking.currency, i18n.language) : ''}
          />
        ) : null}
        {!showReturnReport && booking.status === 'awaiting_return' ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.info.main + '55',
                backgroundColor: colors.info.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {t(
                'rentals.nextStep.returnReminder',
                'Return by {{time}} at {{location}}. The business will confirm when the item is back.',
                {
                  time: returnByLabel,
                  location:
                    booking.rental_location_listing?.business_location?.name ?? '—',
                }
              )}
            </Text>
            {overtimeAmount > 0 ? (
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.warning.dark ?? colors.warning.main,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {t(
                  'rentals.nextStep.overtimePending',
                  'Overtime payment in progress: {{amount}}.',
                  {
                    amount: formatRentalMoney(
                      overtimeAmount,
                      pricing?.currency ?? booking.currency
                    ),
                  }
                )}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.status', 'Status')}
          </Text>
          {booking.status === 'cancelled' ? (
            <Text style={[typography.body2, { color: colors.error.main, marginTop: spacing.xs }]}>
              {t('rentals.cancelled', 'Booking cancelled')}
            </Text>
          ) : booking.status === 'reserved' || booking.status === 'confirmed' || booking.status === 'active' || booking.status === 'awaiting_return' || booking.status === 'completed' ? (
            <RentalJourneyList
              hideTitle
              status={booking.status}
              payAtPickup={booking.payment_timing === 'pay_at_pickup' || booking.currency === 'XAF' || booking.currency === 'XOF'}
              paid={booking.payment_status === 'paid' || booking.payment_status === 'authorized'}
              paidAside={paidAside}
              pickupAside={pickupAside}
              early={earlyJourney}
            />
          ) : (
            timelineSteps.map((step, idx) => {
              const done = currentIdx >= idx;
              const reviewNow = step === REPORT_REVIEW_STEP && idx === currentIdx;
              const returnNow = step === 'awaiting_return' && idx === currentIdx;
              const labelKey = bookingDetailStatusLabelKey(step);
              return (
                <View key={step} style={[styles.timelineRow, { marginTop: spacing.xs }]}>
                  <MaterialCommunityIcons
                    name={reviewNow || returnNow ? 'circle' : done ? 'check-circle' : 'circle-outline'}
                    size={18}
                    color={reviewNow || returnNow ? '#0A4FB5' : done ? colors.success.main : colors.text.disabled}
                  />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text
                      style={[
                        typography.body2,
                        {
                          color: done ? colors.text.primary : colors.text.disabled,
                          fontWeight: done && idx === currentIdx ? '700' : '400',
                        },
                      ]}
                    >
                      {t(labelKey, DETAIL_STATUS_DEFAULTS[labelKey] ?? step)}
                    </Text>
                    {step === 'awaiting_return' && (returnPhase === 'waiting' || returnPhase === 'escalated') ? (
                      <Text style={[typography.caption, { color: '#0A4FB5' }]}>
                        {returnPhase === 'escalated'
                          ? t('rentals.returnReport.escalatedStepper', 'Support is checking')
                          : t('rentals.returnReport.waitingStepper', 'Waiting for confirmation')}
                      </Text>
                    ) : null}
                    {step === 'awaiting_return' && returnPhase === 'overdue' ? (
                      <Text style={[typography.caption, { color: colors.error.main }]}>
                        {t('rentals.returnReport.overdue', 'Overdue')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {paymentPending ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.warning.main + '55',
                backgroundColor: colors.warning.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {isStripePending
                ? t(
                    'client.rentals.waitingPaymentStripe',
                    'Complete card payment to confirm this reservation. Use Retry payment if you closed the payment sheet.'
                  )
                : t('client.rentals.waitingPayment', 'Waiting for payment…')}
            </Text>
            {booking.contract_expires_at ? (
              <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
                {t('rentals.clientRequests.contractCompleteBy', 'Complete booking by {{date}}', {
                  date: formatListingDeadline(booking.contract_expires_at, i18n.language),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.clientRequests.requestedPeriod', 'Requested period')}
          </Text>
          {(periodLines.length ? periodLines : ['—']).map((line, index) => (
            <Text
              key={`${index}-${line}`}
              style={[typography.body2, { color: colors.text.primary, marginTop: index === 0 ? 4 : 2 }]}
            >
              {line}
            </Text>
          ))}
          <Text style={[typography.subtitle2, { color: colors.text.primary, marginTop: spacing.md }]}>
            {t('rentals.clientRequests.quotedTotal', 'Quoted total')}
          </Text>
          <Text style={[typography.h6, { color: colors.text.primary }]}>
            {formatDetailMoney(pricing?.total ?? toAmount(booking.total_amount))}
          </Text>
          {hold.showDeposit ? (
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}
              {': '}
              {formatDetailMoney(depositAmount)}
            </Text>
          ) : null}
          {authorizedAmount > 0 ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t(
                holdCopyKey(hold.additive, booking.inspection_policy_version != null),
                holdCopyFallback(hold.additive, booking.inspection_policy_version != null),
                { amount: formatDetailMoney(authorizedAmount) }
              )}
            </Text>
          ) : null}
          {isPayAtPickup && booking.payment_status !== 'paid' ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t(
                'rentals.bookingDetail.payAtPickup',
                'Nothing paid yet — the rental total is due at pickup.'
              )}
            </Text>
          ) : null}
          {overtimeAmount > 0 ? (
            <Text style={[typography.body2, { color: colors.warning.dark ?? colors.warning.main, marginTop: spacing.xs }]}>
              {t('rentals.bookingDetail.overtimeDue', 'Extra hours: {{amount}}', {
                amount: formatRentalMoney(
                  overtimeAmount,
                  pricing?.currency ?? booking.currency
                ),
              })}
            </Text>
          ) : null}
          {canCancel ? (
            <Text style={[typography.caption, { color: colors.success.main, marginTop: spacing.xs }]}>
              {t(
                'rentals.clientRequests.freeCancelBeforeStart',
                'Free cancellation any time before the rental starts.'
              )}
            </Text>
          ) : null}
        </View>

        {isReserved && flags.rentals_card_charge_at_pickup_enabled ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.info.main + '55',
                backgroundColor: colors.info.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {snapshot.enrolled
                ? t(
                    'rentals.bookingDetail.reservedClientHintInspected',
                    'Your reservation is held for free. Pay when you accept the condition report at pickup.'
                  )
                : t(
                    'rentals.bookingDetail.reservedClientHint',
                    'Your reservation is held for free. On the pickup day, tap Start rental. Pay then if it is still due.'
                  )}
            </Text>
          </View>
        ) : null}

        <BookingQuickActions
          title={title}
          start={booking.start_at}
          end={booking.end_at}
          location={booking.rental_location_listing?.business_location?.name}
          showCancel={canCancel}
          onMessage={() => scrollRef.current?.scrollTo({ y: messagesY.current, animated: true })}
          onCancel={() => setCancelOpen(true)}
        />

        {booking.status !== 'cancelled' ? (
          <View
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
            onLayout={(event) => {
              messagesY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: spacing.sm }]}>
              {t('rentals.messages.title', 'Messages')}
            </Text>
            <OrderMessageComposer
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              mentionableParticipants={mentionableParticipants}
              onSend={async (message, mentionedUserId) => {
                const ok = await sendMessage(message, mentionedUserId);
                if (ok && messages[0]?.id) {
                  void markMessagesRead(messages[0].id);
                }
                return ok;
              }}
              formatDate={formatMessageDate}
              onRefresh={() => void refetchMessages()}
              emptyHint={t(
                'rentals.messages.emptyHint',
                'Message the other party about pickup, return, or the rental.'
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {paymentPending || reviewStage ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            gap: spacing.sm,
          }}
        >
          {paymentPending ? (
            <Button
              mode="contained"
              loading={actionLoading || sheetLoading}
              onPress={() => void onRetry()}
            >
              {t('rentals.actions.completePayment', 'Complete payment')}
            </Button>
          ) : (
            <Button
              mode="contained"
              buttonColor={colors.primary.main}
              icon={
                confirmationsOn && reviewStage === 'pickup' && snapshot.pickup?.yourDecision !== 'accept'
                  ? 'clipboard-check'
                  : undefined
              }
              style={{ minHeight: 48 }}
              onPress={() =>
                navigation.navigate('ClientInspection', {
                  bookingId: booking.id,
                  stage: reviewStage ?? 'pickup',
                })
              }
            >
              {reviewStage === 'return'
                ? t('rentalInspection.returnReview', 'Review the return against pickup photos')
                : snapshot.pickup?.yourDecision === 'accept'
                  ? t('rentalInspection.acceptAndStart', 'Accept condition & start rental')
                  : t('rentalInspection.reviewTitle', 'Review item condition')}
            </Button>
          )}
        </View>
      ) : null}

      <CancelBookingDialog
        visible={cancelOpen}
        fee={cancelFee}
        feeLabel={formatConfirmationMoney(reservationFee(booking), booking.currency, i18n.language)}
        flagged={pickupFlagged}
        onDismiss={() => setCancelOpen(false)}
        onConfirm={() => void onCancel()}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>

      <ImageLightbox
        visible={lightboxOpen}
        images={bookingImages}
        index={lightboxIdx}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIdx}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', aspectRatio: 16 / 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  card: { borderWidth: 1 },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
});
