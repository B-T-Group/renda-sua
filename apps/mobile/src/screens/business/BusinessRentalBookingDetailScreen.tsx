import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '../../components/common/StatusPill';
import { OrderMessageComposer } from '../../components/messaging/OrderMessageComposer';
import { BusinessReturnedBanner } from '../../components/rentals/BusinessReturnedBanner';
import { BusinessDeclineBanner } from '../../components/rentals/DeclinePickupScreens';
import { RentalPhaseBanner } from '../../components/rentals/RentalPhaseBanner';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { InspectionTimeline } from '../../components/rentals/inspection/InspectionTimeline';
import { PickupDayCallout } from '../../components/rentals/inspection/PickupPhotoChrome';
import { useTheme } from '../../contexts/ThemeContext';
import { useInspectionSnapshot } from '../../hooks/useInspectionSnapshot';
import { RentalStartCard } from '../../components/rentals/RentalStartCard';
import { RentalJourneyList } from '../../components/rentals/RentalJourneyList';
import { BusinessPhotoRequest } from '../../components/rentals/inspection/BusinessPhotoRequest';
import { useRentalBookingMessages } from '../../hooks/useRentalBookingMessages';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { RentalBookingDetail } from '../../types/rentals';
import {
  REPORT_REVIEW_STEP,
  bookingDetailStatusLabelKey,
  bookingDetailStepLabelKey,
  bookingDetailTimeline,
  bookingDetailTimelineIndex,
  parseRentalSelectionWindows,
  rentalBookingStatusColors,
  resolveBookingPhase,
} from '../../utils/rentals';
import { bookingRequestedPeriodLines, formatListingDue, formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';
import {
  confirmationTimeZone,
  confirmationZoneDefault,
  formatBookedSpan,
  formatConfirmationMoney,
} from '../../utils/rentals/confirmationFormat';
import { formatStoredPhone } from '../../utils/phoneLoginUsername';
import { formatDoualaStamp } from '../../utils/rentals/renterReturnPhase';
import { holdPresentation, type HoldPresentation } from '../../utils/rentals/cardDeposit';
import {
  businessCanReplaceReport,
  reportReadyToReview,
  pickupGate,
  showEnrolledReturn,
  didntReceiveWindowOpen,
  showLegacyReturnPicker,
} from '../../utils/rentals/rentalInspection';
import { RentalHandoverNotice } from '../../components/rentals/RentalHandoverNotice';
import { BOOKING_CLOCK, formatZonedDay, formatZonedWhen, pickupClockLabel, pickupPhase, type PickupPhase } from '../../utils/rentals/rentalStartWindow';
import { bookingReturnDue } from '../../utils/rentals/returnDue';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalBookingDetail'>;

export default function BusinessRentalBookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { flags, loading: flagsLoading } = useClientFlags();
  const route = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const bookingId = route.params.bookingId;

  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    refetch: refetchMessages,
    mentionableParticipants,
  } = useRentalBookingMessages(bookingId);
  const snapshot = useInspectionSnapshot(bookingId, booking);
  const confirmationsOn = !flagsLoading && flags.rentals_inspection_confirmations_enabled;

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const data = await rentalsApi.getBooking(bookingId);
      setBooking(data);
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      if (!confirmationsOn) return undefined;
      void load({ soft: true });
      void snapshot.reload();
      return undefined;
    }, [confirmationsOn, load, snapshot.reload])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load({ soft: true }), refetchMessages()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refetchMessages]);

  const formatMessageDate = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }, []);

  const returnIsOvertime = (() => {
    const dueAt = bookingReturnDue(booking);
    if (!dueAt || !returnDate || !returnTime) return false;
    const iso = combineLocalDateTime(returnDate, returnTime);
    if (!iso) return false;
    return new Date(iso).getTime() > new Date(dueAt).getTime();
  })();

  const reportNotCollected = useCallback(async () => {
    setBusy(true);
    try {
      await rentalsApi.reportItemNotCollected(bookingId);
      setSnack(t('rentals.business.notCollectedSent', 'Support was notified that the item was not collected.'));
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    } finally {
      setBusy(false);
    }
  }, [bookingId, t]);

  const openReturnDialog = useCallback(() => {
    const parts = localDateTimeParts(new Date());
    setReturnDate(parts.date);
    setReturnTime(parts.time);
    setReturnDialog(true);
  }, []);

  const submitReturn = useCallback(async () => {
    const actualEndAt = combineLocalDateTime(returnDate, returnTime);
    if (!actualEndAt) {
      setSnack(
        t('rentals.returnAtInvalid', 'Enter a valid return date and time')
      );
      return;
    }
    setBusy(true);
    try {
      const res = await rentalsApi.confirmReturn(bookingId, { actualEndAt });
      setReturnDialog(false);
      setSnack(
        res.paymentPending || res.overtimeDue
          ? t(
              'rentals.returnOvertimePending',
              'Return recorded. A payment request for the extra hours was sent to the client — the booking completes once it is paid.'
            )
          : t('rentals.completed', 'Completed and settled')
      );
      await load();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('business.rentals.returnFailed', 'Could not confirm return')
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, load, returnDate, returnTime, t]);

  const cancelBooking = useCallback(async () => {
    setBusy(true);
    try {
      await rentalsApi.cancelBooking(bookingId);
      setCancelDialog(false);
      setSnack(t('rentals.cancelled', 'Booking cancelled'));
      await load();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('rentals.cancelError', 'Could not cancel booking')
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, load, t]);

  if (loading && !booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('rentals.bookingNotFound', 'Booking not found')}</Text>
      </View>
    );
  }

  const sc = rentalBookingStatusColors(booking.status, colors);
  const phaseInfo = resolveBookingPhase(booking.status, 'business');
  const listingCountry = booking.rental_location_listing?.business_location?.address?.country;
  const listingZone = confirmationTimeZone(listingCountry, booking.currency);
  const photosAsked = snapshot.pickup?.status === 'correction_requested';
  const startPhase = pickupPhase({
    now: Date.now(),
    startAt: booking.start_at,
    endAt: booking.end_at,
    startOpensAt: booking.start_opens_at,
    timeZone: listingZone,
    started: booking.status === 'active' || Boolean(booking.actual_start_at),
  });
  const pickupDay = formatZonedDay(booking.start_at, BOOKING_CLOCK, i18n.language);
  const returnWhen = formatZonedWhen(bookingReturnDue(booking) ?? booking.end_at, BOOKING_CLOCK, i18n.language);
  const bookedSpan = formatBookedSpan(
    booking.start_at,
    booking.end_at,
    confirmationTimeZone(listingCountry, booking.currency),
    i18n.language,
    confirmationZoneDefault(listingCountry, booking.currency, i18n.language)
  );
  const periodLines = bookedSpan
    ? [bookedSpan]
    : bookingRequestedPeriodLines(
        parseRentalSelectionWindows(booking.rental_request?.rental_selection_windows),
        booking,
        i18n.language,
        (count) => t('rentals.requestForm.dayCount', '{{count}} day', { count })
      );
  const detailMoney = (amount: number) =>
    (booking.currency || '').toUpperCase() === 'CAD'
      ? formatConfirmationMoney(amount, 'CAD', i18n.language)
      : formatRequestAmount(amount, booking.currency, i18n.language);
  const client = booking.client?.user;
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
  const reviewReady =
    confirmationsOn &&
    snapshot.enrolled &&
    reportReadyToReview({ status: booking.status, pickup: snapshot.pickup });
  const waitingSteps = reviewReady
    ? bookingDetailTimeline(booking.status, { includeReview: true })
    : [];
  const waitingIndex = reviewReady
    ? bookingDetailTimelineIndex(waitingSteps, booking.status, { reviewCurrent: true })
    : 0;
  const gate = pickupGate({
    enrolled: snapshot.enrolled,
    status: booking.status,
    submitted: snapshot.pickup?.status === 'submitted' && !snapshot.pickup.yourDecision,
    accepted: snapshot.pickup?.yourDecision === 'accept',
  });
  const canReturn = showLegacyReturnPicker(snapshot.enrolled, booking.status);
  const showReturnInspection = showEnrolledReturn(snapshot.enrolled, booking.status);
  const showRenterReport =
    !flagsLoading &&
    flags.rentals_renter_return_report_enabled &&
    Boolean(booking.renter_reported_returned_at);
  const isReserved = booking.status === 'reserved';
  const canCancel =
    (booking.status === 'confirmed' || isReserved) && !booking.actual_start_at;
  const depositAmount = Math.max(0, Number(booking.security_deposit_amount) || 0);
  const authorizedAmount = Math.max(0, Number(booking.authorized_amount) || 0);
  const presentation = holdPresentation({
    total: Number(booking.total_amount) || 0,
    deposit: depositAmount,
    authorized: authorizedAmount,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + 32,
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
      {booking.condition_declined_at && booking.condition_decline ? (
        <BusinessDeclineBanner
          reason={booking.condition_decline.reason}
          note={booking.condition_decline.reasonText}
          photos={booking.condition_decline.photos}
          timeZone={booking.currency === 'XAF' || booking.currency === 'XOF' ? 'Africa/Douala' : 'America/Toronto'}
          onViewBooking={() => navigation.navigate('BusinessRentalBookingDetail', { bookingId: booking.id })}
        />
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
          },
        ]}
      >
        <View style={styles.row}>
          <Text style={[typography.subtitle1, { color: colors.text.primary, flex: 1 }]}>
            {booking.rental_location_listing?.rental_item?.name ??
              t('business.rentals.booking', 'Booking')}
          </Text>
          <StatusPill
            compact
            label={handoverPill(booking.status, photosAsked, startPhase, pickupDay, reviewReady, phaseInfo.labelKey, t)}
            backgroundColor={reviewReady ? '#B4530918' : phaseTone(startPhase, colors)?.backgroundColor ?? sc.backgroundColor}
            textColor={reviewReady ? '#B45309' : phaseTone(startPhase, colors)?.textColor ?? sc.textColor}
            borderColor={reviewReady ? '#B4530944' : phaseTone(startPhase, colors)?.borderColor ?? sc.borderColor}
          />
        </View>
        {booking.booking_number ? (
          <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
            {booking.booking_number}
          </Text>
        ) : null}
        <View style={{ marginTop: 8 }}>
          {(periodLines.length ? periodLines : ['—']).map((line, index) => (
            <Text
              key={`${index}-${line}`}
              style={{ color: colors.text.secondary, marginTop: index === 0 ? 0 : 2 }}
            >
              {line}
            </Text>
          ))}
        </View>
        <BookingMoney
          presentation={presentation}
          total={detailMoney(Number(booking.total_amount) || 0)}
          deposit={detailMoney(depositAmount)}
          held={detailMoney(presentation.mode === 'sentence' ? presentation.amount : authorizedAmount)}
        />
      </View>

      {reviewReady ? (
        <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider }}>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>{t('rentals.status', 'Status')}</Text>
          {waitingSteps.map((step, idx) => (
            <WaitingStep key={step} step={step} idx={idx} current={waitingIndex} />
          ))}
        </View>
      ) : null}

      {showRenterReport || booking.status === 'reserved' || booking.status === 'confirmed' || booking.status === 'active' ? null : (
      <View style={{ marginTop: spacing.md }}>
        <RentalPhaseBanner
          bookingStatus={booking.status}
          chipLabel={reviewReady ? t('rentalInspection.phase.waitingRenter', 'Waiting for renter') : undefined}
          role="business"
          nextStepKey={
            snapshot.enrolled &&
            (booking.status === 'reserved' || booking.status === 'confirmed')
              ? 'rentalInspection.bannerWaiting'
              : undefined
          }
          action={
            canReturn && !showRenterReport ? (
              <Button
                mode="contained"
                disabled={busy}
                onPress={openReturnDialog}
                style={{ marginTop: 4 }}
              >
                {t('rentals.actions.confirmReturn', 'Confirm return')}
              </Button>
            ) : null
          }
        />
      </View>
      )}

      {isReserved && !snapshot.enrolled ? (
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
          <Text style={{ color: colors.text.primary }}>
            {booking.currency === 'XAF' || booking.currency === 'XOF'
              ? t(
                  'rentals.bookingDetail.reservedBusinessMomo',
                  '{{name}} pays {{amount}} by Mobile Money when they tap Start. You don\'t collect anything.',
                  { name: clientName || t('rentals.renter', 'The renter'), amount: detailMoney(Number(booking.total_amount) || 0) }
                )
              : t(
                  'rentals.bookingDetail.reservedBusinessHint',
                  'Reserved without payment. The renter starts this rental on the pickup day and pays then if it is still due.'
                )}
          </Text>
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
          {t('business.rentals.clientDetails', 'Client details')}
        </Text>
        <Text style={{ color: colors.text.secondary, marginTop: 6 }}>
          {clientName || '—'}
        </Text>
        {client?.phone_number ? (
          <Text style={{ color: colors.text.secondary }}>{formatStoredPhone(client.phone_number)}</Text>
        ) : null}
        {client?.email ? (
          <Text style={{ color: colors.text.secondary }}>{client.email}</Text>
        ) : null}
      </View>

      {showRenterReport && booking.renter_reported_returned_at ? (
        <BusinessReturnedBanner
          title={t('rentals.returnReport.businessBanner', 'Renter says item returned · {{time}}', {
            time: formatDoualaStamp(booking.renter_reported_returned_at, i18n.language),
          })}
          body={t(
            'rentals.returnReport.businessBody',
            'Please check the item, then confirm the return. The {{amount}} deposit is released only after you confirm.',
            { amount: formatRequestAmount(Number(booking.security_deposit_amount) || 0, booking.currency || 'XAF', i18n.language) }
          )}
          onConfirm={() => {
            if (showReturnInspection) {
              navigation.navigate('BusinessInspection', { bookingId, stage: 'return' });
              return;
            }
            openReturnDialog();
          }}
          onProblem={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'return' })}
        />
      ) : null}

      {snapshot.enrolled && !photosAsked ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <BusinessAcceptStartHero
            booking={booking}
            submittedUnits={snapshot.pickup?.units.length ?? 0}
            canUpdate={businessCanReplaceReport(snapshot.pickup)}
            onUpdate={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'pickup' })}
          />
          {gate.mode === 'capture' && (booking.status === 'reserved' || booking.status === 'confirmed') ? (
            flags.rentals_pickup_photo_rules_enabled ? (
              <PickupDayCallout
                bookingId={bookingId}
                onOpen={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'pickup' })}
              />
            ) : (
              <Button
                mode="contained"
                buttonColor={colors.cta.main}
                style={{ minHeight: 48 }}
                onPress={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'pickup' })}
              >
                {t('rentalInspection.pickupTitle', 'Pickup condition')}
              </Button>
            )
          ) : null}
          {showReturnInspection && !showRenterReport ? (
            <Button
              mode="contained"
              buttonColor={colors.cta.main}
              style={{ minHeight: 48 }}
              onPress={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'return' })}
            >
              {t('rentalInspection.returnTitle', 'Return condition')}
            </Button>
          ) : null}
          <InspectionTimeline role="business" booking={booking} pickup={snapshot.pickup} returnView={snapshot.returnView} />
        </View>
      ) : null}

      {photosAsked && !showRenterReport ? (
        <BusinessPhotoRequest
          bookingId={bookingId}
          renterName={clientName || t('rentals.renter', 'The renter')}
          reason={snapshot.pickup?.correctionReason}
          photos={(snapshot.pickup?.units[0]?.photos ?? []).map((photo) => ({
            ...photo,
            unitId: snapshot.pickup?.units[0]?.unitId ?? '',
          }))}
          timeZone={listingZone}
          askedAt={snapshot.pickup?.askedAt || snapshot.pickup?.submittedAt}
          onSent={() => void load({ soft: true })}
        />
      ) : null}

      {(booking.status === 'reserved' || booking.status === 'confirmed' || booking.status === 'active') && !showRenterReport && !photosAsked ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {booking.status === 'active' && didntReceiveWindowOpen(booking.actual_start_at) ? (
            <RentalHandoverNotice
              mode="banner"
              renterName={clientName || t('rentals.renter', 'The renter')}
              itemName={booking.rental_location_listing?.rental_item?.name ?? ''}
            />
          ) : null}
          <RentalStartCard
            booking={booking}
            timeZone={confirmationTimeZone(listingCountry, booking.currency)}
            role="business"
            renterName={clientName || undefined}
            place={booking.rental_location_listing?.business_location?.name ?? ''}
            money={detailMoney(Number(booking.total_amount) || 0)}
            returnLabel={returnWhen}
            starting={busy}
            open={false}
            onOpen={() => undefined}
            onClose={() => undefined}
            onConfirm={() => undefined}
            onNotCollected={booking.status === 'active' ? () => void reportNotCollected() : undefined}
          />
          <View
            style={[
              styles.card,
              { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md },
            ]}
          >
            <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: 8 }]}>
              {t('rentals.status', 'Status')}
            </Text>
            <RentalJourneyList
              hideTitle
              status={booking.status}
              payAtPickup={booking.payment_timing === 'pay_at_pickup'}
              paidAside={
                (booking.payment_status === 'paid' || booking.payment_status === 'authorized') && (booking.paid_at || booking.created_at)
                  ? formatZonedDay(booking.paid_at || booking.created_at || '', listingZone, i18n.language)
                  : undefined
              }
              pickupAside={pickupClockLabel(booking.actual_start_at, booking.start_at, listingZone, i18n.language)}
              paid={booking.payment_status === 'paid' || booking.payment_status === 'authorized'}
              accent={colors.success.main}
            />
          </View>
        </View>
      ) : null}

      {canCancel ? (
        <Button
          mode="outlined"
          icon="close-circle-outline"
          textColor={colors.error.main}
          style={{ marginTop: spacing.md }}
          disabled={busy}
          onPress={() => setCancelDialog(true)}
        >
          {t('rentals.cancelBooking', 'Cancel booking')}
        </Button>
      ) : null}

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
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: 8 }]}>
            {t('rentals.messages.title', 'Messages')}
          </Text>
          <OrderMessageComposer
            messages={messages}
            loading={messagesLoading}
            error={messagesError}
            mentionableParticipants={mentionableParticipants}
            onSend={sendMessage}
            formatDate={formatMessageDate}
            onRefresh={() => void refetchMessages()}
            emptyHint={t(
              'rentals.messages.emptyHint',
              'Message the other party about pickup, return, or the rental.'
            )}
          />
        </View>
      ) : null}

      <Portal>

        <Dialog visible={cancelDialog} onDismiss={() => setCancelDialog(false)}>
          <Dialog.Title>{t('rentals.cancelBooking', 'Cancel booking')}</Dialog.Title>
          <Dialog.Content>
            <Text>
              {t(
                'rentals.bookingDetail.cancelBeforeStartMessage',
                'This booking has not started, so cancellation is free. Any card hold or wallet hold is released.'
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCancelDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              loading={busy}
              textColor={colors.error.main}
              onPress={() => void cancelBooking()}
            >
              {t('rentals.cancelBooking', 'Cancel booking')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={returnDialog}
          onDismiss={() => !busy && setReturnDialog(false)}
        >
          <Dialog.Title>{t('rentals.confirmReturn', 'Confirm return')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
              {t(
                'rentals.returnAtHint',
                'Select when the item was returned. Early returns still pay the full rental total; time after the booked end is billed as overtime.'
              )}
            </Text>
            <Button
              mode="outlined"
              style={{ marginBottom: 10 }}
              disabled={busy}
              onPress={() => {
                const parts = localDateTimeParts(new Date());
                setReturnDate(parts.date);
                setReturnTime(parts.time);
              }}
            >
              {t('rentals.returnUseNow', 'Use current time')}
            </Button>
            {booking.end_at ? (
              <Button
                mode="outlined"
                style={{ marginBottom: 10 }}
                disabled={busy}
                onPress={() => {
                  const parts = localDateTimeParts(new Date(bookingReturnDue(booking) ?? booking.end_at));
                  setReturnDate(parts.date);
                  setReturnTime(parts.time);
                }}
              >
                {t('rentals.returnUseBookedEnd', 'Use booked end time')}
              </Button>
            ) : null}
            <Text style={{ marginBottom: 6, color: colors.text.secondary, fontSize: 12 }}>
              {t(
                'rentals.returnSelectedAt',
                'Selected return: {{date}} {{time}}',
                { date: returnDate || '—', time: returnTime || '—' }
              )}
            </Text>
            <TextInput
              label={t('rentals.returnDate', 'Return date')}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="YYYY-MM-DD"
              mode="outlined"
              style={{ marginBottom: 10 }}
              disabled={busy}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              label={t('rentals.returnTime', 'Return time')}
              value={returnTime}
              onChangeText={setReturnTime}
              placeholder="HH:mm"
              mode="outlined"
              disabled={busy}
              keyboardType="numbers-and-punctuation"
            />
            {returnIsOvertime ? (
              <Text style={{ marginTop: 10, color: colors.warning.dark ?? colors.warning.main }}>
                {t(
                  'rentals.returnOvertimeHint',
                  'This return time is after the booked end — overtime may be charged.'
                )}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReturnDialog(false)} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button loading={busy} onPress={() => void submitReturn()}>
              {t('rentals.confirmReturn', 'Confirm return')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

function localDateTimeParts(d: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function BusinessAcceptStartHero({
  booking,
  submittedUnits,
  canUpdate,
  onUpdate,
}: {
  booking: RentalBookingDetail;
  submittedUnits: number;
  canUpdate: boolean;
  onUpdate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const started = booking.status === 'active' || booking.status === 'awaiting_return';
  const waiting =
    !started &&
    !booking.actual_start_at &&
    submittedUnits > 0 &&
    (booking.status === 'reserved' || booking.status === 'confirmed');
  if (!started && !waiting) return null;
  const name = booking.client?.user?.first_name || t('rentalInspection.renterFallback', 'The renter');
  const due = formatListingDue(bookingReturnDue(booking) ?? booking.end_at, i18n.language);
  const paid =
    (booking.currency || '').toUpperCase() === 'CAD'
      ? formatConfirmationMoney(Number(booking.total_amount) || 0, 'CAD', i18n.language)
      : formatRequestAmount(Number(booking.total_amount) || 0, booking.currency, i18n.language);
  const units = booking.units_booked || submittedUnits;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center' }]}>
        {started
          ? t('rentalInspection.startedTitle', 'Started, hand over the item')
          : t('rentalInspection.waitingTitle', 'Waiting for the renter to accept')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
        {started ? (
          <>
            {t('rentalInspection.startedBodyLead', '{{name}} accepted the condition and the rental is in progress. Return is due by', { name })}{' '}
            <Text style={{ color: colors.text.secondary }}>{due}.</Text>
          </>
        ) : (
          t('rentalInspection.waitingBody', "{{name}} is reviewing the condition report. You'll see when the rental starts — then hand over the item.", { name })
        )}
      </Text>
      {started ? (
        <Text style={{ color: colors.success.main, textAlign: 'center', fontWeight: '700' }}>
          {booking.payment_status === 'authorized'
            ? t('rentalInspection.heldAmount', '{{amount}} held', { amount: paid })
            : t('rentalInspection.paidAmount', '{{amount}} paid', { amount: paid })}
        </Text>
      ) : (
        <View style={{ backgroundColor: colors.infoTint, borderRadius: borderRadius.md, padding: spacing.md }}>
          <Text style={{ color: colors.text.primary }}>
            {t('rentalInspection.noPinNote', 'Pickup photos submitted · {{count}} of {{total}} units.', {
              count: submittedUnits,
              total: units,
            })}
          </Text>
        </View>
      )}
      {!started && canUpdate ? (
        <Button mode="outlined" textColor={colors.cta.main} style={{ minHeight: 48 }} onPress={onUpdate}>
          {t('rentalInspection.updateReport', 'Update report')}
        </Button>
      ) : null}
    </View>
  );
}

function WaitingStep({ step, idx, current }: { step: string; idx: number; current: number }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const reviewNow = step === REPORT_REVIEW_STEP && idx === current;
  const done = current > idx;
  const labelKey = bookingDetailStepLabelKey(step, 'business');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
      <MaterialCommunityIcons
        name={reviewNow ? 'circle' : done ? 'check-circle' : 'circle-outline'}
        size={18}
        color={reviewNow ? colors.cta.main : done ? colors.success.main : colors.text.disabled}
      />
      <Text style={[typography.body2, { marginLeft: spacing.sm, color: done || reviewNow ? colors.text.primary : colors.text.disabled, fontWeight: reviewNow ? '700' : '400' }]}>
        {t(labelKey, step === REPORT_REVIEW_STEP ? 'Waiting for renter' : step)}
      </Text>
    </View>
  );
}

/** Combine local YYYY-MM-DD + HH:mm into an ISO timestamp, or null if invalid. */
function combineLocalDateTime(date: string, time: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m || !tm) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (
    mo < 0 ||
    mo > 11 ||
    day < 1 ||
    day > 31 ||
    h < 0 ||
    h > 23 ||
    mi < 0 ||
    mi > 59
  ) {
    return null;
  }
  const d = new Date(y, mo, day, h, mi, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function phaseTone(
  phase: PickupPhase,
  colors: { warning: { main: string; dark?: string }; success: { main: string; dark?: string } }
) {
  const tone = phase === 'late' ? colors.warning : phase === 'today' || phase === 'before' ? colors.success : null;
  if (!tone) return null;
  return {
    backgroundColor: tone.main + '18',
    textColor: tone.dark ?? tone.main,
    borderColor: tone.main + '44',
  };
}

function handoverPill(
  status: string,
  photosAsked: boolean,
  phase: PickupPhase,
  day: string,
  reviewReady: boolean,
  fallbackKey: string,
  t: (key: string, fallback: string, vars?: Record<string, string>) => string,
): string {
  if (photosAsked) return t('rentals.business.photosPill', 'New photos asked');
  if (reviewReady) return t('rentalInspection.phase.waitingRenter', 'Waiting for renter');
  if (status === 'awaiting_return') return t(bookingDetailStatusLabelKey(status), 'Return due');
  if (status === 'reserved' || status === 'confirmed' || status === 'active') return phaseLabel(phase, day, t);
  return t(fallbackKey, status);
}

function BookingMoney(props: {
  presentation: HoldPresentation;
  total: string;
  deposit: string;
  held: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (props.presentation.mode === 'sentence') return <HeldSentence held={props.held} />;
  return (
    <View>
      <Text style={{ color: colors.text.primary, marginTop: 8, fontWeight: '600' }}>{props.total}</Text>
      {props.presentation.mode === 'split' ? (
        <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
          {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}
          {': '}
          {props.deposit}
        </Text>
      ) : null}
    </View>
  );
}

function HeldSentence({ held }: { held: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.text.primary, marginTop: 8, fontWeight: '600' }}>
      {t('rentals.bookingDetail.heldOnRenterCard', "{{amount}} held on the renter's card", { amount: held })}
    </Text>
  );
}

function phaseLabel(
  phase: PickupPhase,
  day: string,
  t: (key: string, fallback: string, vars?: Record<string, string>) => string,
): string {
  if (phase === 'before') return t('rentals.start.pillDay', 'Pickup {{day}}', { day });
  if (phase === 'late') return t('rentals.start.latePickup', 'Late pickup');
  if (phase === 'started') return t('rentals.journey.inProgress', 'In progress');
  if (phase === 'today') return t('rentals.start.pickupToday', 'Pickup today');
  return t('rentals.phases.readyForPickup', 'Ready for pickup');
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
