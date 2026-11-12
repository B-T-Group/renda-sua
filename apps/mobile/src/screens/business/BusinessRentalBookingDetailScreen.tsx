import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import { RentalPhaseBanner } from '../../components/rentals/RentalPhaseBanner';
import { InspectionTimeline } from '../../components/rentals/inspection/InspectionTimeline';
import { unpaidCancelMinutesLeft } from '../../utils/rentals/rentalInspection';
import { useTheme } from '../../contexts/ThemeContext';
import { useInspectionSnapshot } from '../../hooks/useInspectionSnapshot';
import { useActiveRentalStartPin } from '../../hooks/useActiveRentalStartPin';
import { useRentalBookingMessages } from '../../hooks/useRentalBookingMessages';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { RentalBookingDetail } from '../../types/rentals';
import {
  formatRentalMoney,
  parseRentalSelectionWindows,
  rentalBookingStatusColors,
  resolveBookingPhase,
} from '../../utils/rentals';
import { bookingRequestedPeriodLines, formatListingDue, formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';
import {
  businessCanReplaceReport,
  classifyInspectionError,
  pickupGate,
  showEnrolledReturn,
  showLegacyReturnPicker,
} from '../../utils/rentals/rentalInspection';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalBookingDetail'>;

export default function BusinessRentalBookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const bookingId = route.params.bookingId;

  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [overwriteInput, setOverwriteInput] = useState('');
  const [pinDialog, setPinDialog] = useState(false);
  const [overwriteDialog, setOverwriteDialog] = useState(false);
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
  const {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  } = useActiveRentalStartPin(bookingId, pinDialog);
  const [showManualPin, setShowManualPin] = useState(false);
  const snapshot = useInspectionSnapshot(bookingId, booking);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const data = await rentalsApi.getBooking(bookingId);
      setBooking(data);
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [bookingId]);

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
    if (!booking?.end_at || !returnDate || !returnTime) return false;
    const iso = combineLocalDateTime(returnDate, returnTime);
    if (!iso) return false;
    return new Date(iso).getTime() > new Date(booking.end_at).getTime();
  })();

  const verifyPin = useCallback(async (opts?: {
    useShared?: boolean;
  }) => {
    setBusy(true);
    try {
      if (opts?.useShared) {
        await rentalsApi.verifyStartPin(bookingId, {
          useLatestSharedPin: true,
          pinMessageId: autoPinMessageId || undefined,
        });
      } else {
        await rentalsApi.verifyStartPin(bookingId, { pin: pin.trim() });
      }
      setPinDialog(false);
      setPin('');
      setShowManualPin(false);
      resetSharedPinState();
      setSnack(t('rentals.started', 'Rental started'));
      await load();
    } catch (e: unknown) {
      setSnack(inspectionFailure(e, t) ?? (e instanceof Error ? e.message : t('business.rentals.pinFailed', 'PIN failed')));
    } finally {
      setBusy(false);
    }
  }, [autoPinMessageId, bookingId, load, pin, resetSharedPinState, t]);

  useEffect(() => {
    if (!pinDialog) {
      setShowManualPin(false);
      setPin('');
    }
  }, [pinDialog]);

  useEffect(() => {
    if (pinDialog && autoSharedPin && !showManualPin) {
      setPin(autoSharedPin);
    }
  }, [pinDialog, autoSharedPin, showManualPin]);

  const applyOverwrite = useCallback(async () => {
    setBusy(true);
    try {
      await rentalsApi.verifyStartPin(bookingId, {
        overwriteCode: overwriteInput.trim() || undefined,
      });
      setOverwriteDialog(false);
      setOverwriteInput('');
      setSnack(t('rentals.started', 'Rental started'));
      await load();
    } catch (e: unknown) {
      setSnack(
        inspectionFailure(e, t) ??
          (e instanceof Error
            ? e.message
            : t('business.rentals.overwriteFailed', 'Could not start rental'))
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, load, overwriteInput, t]);

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

  const collectPickupPayment = useCallback(async () => {
    setBusy(true);
    try {
      const res = await rentalsApi.initiatePickupPayment(bookingId);
      setSnack(
        res.confirmed
          ? t('rentals.bookingDetail.pickupPaid', 'Payment collected — rental confirmed')
          : t(
              'rentals.bookingDetail.pickupPaymentSent',
              'Mobile money request sent to the client. The booking confirms once payment lands.'
            )
      );
      await load();
    } catch (e: unknown) {
      setSnack(
        inspectionFailure(e, t) ??
          (e instanceof Error
            ? e.message
            : t('rentals.bookingDetail.pickupPaymentError', 'Could not collect payment'))
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, load, t]);

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
  const periodLines = bookingRequestedPeriodLines(
    parseRentalSelectionWindows(booking.rental_request?.rental_selection_windows),
    booking,
    i18n.language,
    (count) => t('rentals.requestForm.dayCount', '{{count}} day', { count })
  );
  const client = booking.client?.user;
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
  const gate = pickupGate({
    enrolled: snapshot.enrolled,
    status: booking.status,
    submitted: snapshot.pickup?.status === 'submitted' && !snapshot.pickup.yourDecision,
    accepted: snapshot.pickup?.yourDecision === 'accept',
  });
  const canVerify = gate.showStart && !snapshot.loading;
  const canReturn = showLegacyReturnPicker(snapshot.enrolled, booking.status);
  const showReturnInspection = showEnrolledReturn(snapshot.enrolled, booking.status);
  const isReserved = booking.status === 'reserved';
  const showCollectPayment = gate.showCollectPayment && !snapshot.loading;
  const canCancel =
    (booking.status === 'confirmed' || isReserved) && !booking.actual_start_at;
  const depositAmount = Math.max(0, Number(booking.security_deposit_amount) || 0);
  const authorizedAmount = Math.max(0, Number(booking.authorized_amount) || 0);

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
            label={t(phaseInfo.labelKey, booking.status)}
            backgroundColor={sc.backgroundColor}
            textColor={sc.textColor}
            borderColor={sc.borderColor}
          />
        </View>
        {booking.booking_number ? (
          <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
            #{booking.booking_number}
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
        <Text style={{ color: colors.text.primary, marginTop: 8, fontWeight: '600' }}>
          {formatRentalMoney(booking.total_amount, booking.currency)}
        </Text>
        {depositAmount > 0 ? (
          <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
            {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}
            {': '}
            {formatRentalMoney(depositAmount, booking.currency)}
          </Text>
        ) : null}
        {authorizedAmount > 0 ? (
          <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
            {t(
              'business.rentals.authorizedAmount',
              'Held on client card: {{amount}}',
              { amount: formatRentalMoney(authorizedAmount, booking.currency) }
            )}
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.md }}>
        <RentalPhaseBanner
          bookingStatus={booking.status}
          role="business"
          nextStepKey={
            snapshot.enrolled &&
            (booking.status === 'reserved' || booking.status === 'confirmed')
              ? 'rentalInspection.bannerWaiting'
              : undefined
          }
          action={
            showCollectPayment ? (
              <>
                {snapshot.enrolled && unpaidCancelMinutesLeft(booking.reserved_cancel_after) != null ? (
                  <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>
                    {t('rentalInspection.autoCancel', 'Auto-cancel if unpaid: {{minutes}} min left. The clock started when Collect payment opened. Inspection time is not included.', {
                      minutes: unpaidCancelMinutesLeft(booking.reserved_cancel_after),
                    })}
                  </Text>
                ) : null}
                <Button
                  mode="contained"
                  loading={busy}
                  disabled={busy}
                  onPress={() => void collectPickupPayment()}
                  style={{ marginTop: 4 }}
                >
                  {t('rentals.actions.collectPayment', 'Collect payment')}
                </Button>
              </>
            ) : canVerify ? (
              <Button
                mode="contained"
                disabled={busy}
                onPress={() => setPinDialog(true)}
                style={{ marginTop: 4 }}
              >
                {t('rentals.actions.verifyStartPin', 'Verify start PIN')}
              </Button>
            ) : canReturn ? (
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
            {t(
              'rentals.bookingDetail.reservedBusinessHint',
              'Reserved without payment. Collect the rental total at pickup — the start PIN unlocks after payment.'
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
          <Text style={{ color: colors.text.secondary }}>{client.phone_number}</Text>
        ) : null}
        {client?.email ? (
          <Text style={{ color: colors.text.secondary }}>{client.email}</Text>
        ) : null}
      </View>

      {snapshot.enrolled ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <BusinessAcceptStartHero
            booking={booking}
            submittedUnits={snapshot.pickup?.units.length ?? 0}
            canUpdate={businessCanReplaceReport(snapshot.pickup)}
            onUpdate={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'pickup' })}
          />
          {gate.mode === 'capture' && (booking.status === 'reserved' || booking.status === 'confirmed') ? (
            <Button
              mode="contained"
              buttonColor={colors.cta.main}
              style={{ minHeight: 48 }}
              onPress={() => navigation.navigate('BusinessInspection', { bookingId, stage: 'pickup' })}
            >
              {t('rentalInspection.pickupTitle', 'Pickup condition')}
            </Button>
          ) : null}
          {showReturnInspection ? (
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

      {canVerify && snapshot.enrolled ? (
        <Text style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {t('rentalInspection.overwriteSupportOnly', 'Overwrite codes are issued by Rendasua support only — not shown here.')}
        </Text>
      ) : null}
      {canVerify && gate.showOverwrite ? (
        <Button
          mode="text"
          style={{ marginTop: spacing.sm, minHeight: 48 }}
          disabled={busy}
          onPress={() => setOverwriteDialog(true)}
        >
          {t('rentals.enterSupportCode', 'Enter support code')}
        </Button>
      ) : null}

      {canCancel ? (
        <Button
          mode="outlined"
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
        <Dialog visible={pinDialog} onDismiss={() => !busy && setPinDialog(false)}>
          <Dialog.Title>{t('rentals.verifyStart', 'Verify start')}</Dialog.Title>
          <Dialog.Content>
            {resolvingSharedPin ? (
              <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
                {t('rentals.messaging.startPin.resolving', 'Looking for shared start PIN…')}
              </Text>
            ) : null}
            {noSharedPin && !resolvingSharedPin && !autoSharedPin ? (
              <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
                {t(
                  'rentals.messaging.startPin.noShared',
                  'The client has not shared a start PIN in chat yet. Ask them to tap Send start PIN, or enter it manually.'
                )}
              </Text>
            ) : null}
            {autoSharedPin && !showManualPin ? (
              <>
                <Text style={{ marginBottom: 8, color: colors.text.secondary }}>
                  {t(
                    'rentals.messaging.startPin.usingShared',
                    'Using the start PIN shared by the client in chat.'
                  )}
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    letterSpacing: 8,
                    fontSize: 28,
                    fontWeight: '700',
                    color: colors.text.primary,
                    marginVertical: 12,
                  }}
                >
                  {autoSharedPin}
                </Text>
                <Button mode="text" compact onPress={() => setShowManualPin(true)}>
                  {t('rentals.messaging.startPin.enterManually', 'Enter PIN manually instead')}
                </Button>
              </>
            ) : (
              <>
                <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
                  {t(
                    'business.rentals.startRentalHint',
                    'Enter the 4-digit start PIN from the customer.'
                  )}
                </Text>
                <TextInput
                  label={t('rentals.clientPin', 'Client PIN')}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  mode="outlined"
                  maxLength={8}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinDialog(false)} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              loading={busy}
              disabled={busy || resolvingSharedPin || (!autoSharedPin && !pin.trim())}
              onPress={() =>
                void verifyPin({
                  useShared: !!autoSharedPin && !showManualPin,
                })
              }
            >
              {t('common.confirm', 'Confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={overwriteDialog} onDismiss={() => setOverwriteDialog(false)}>
          <Dialog.Title>{t('rentals.enterSupportCode', 'Enter support code')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
              {t(
                'rentals.supportCodeHint',
                'Ask the client for their start PIN. A support code is only for when the client cannot share it, and only support can issue one.'
              )}
            </Text>
            <TextInput
              label={t('rentals.overwriteCode', 'Overwrite code')}
              value={overwriteInput}
              onChangeText={setOverwriteInput}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOverwriteDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button loading={busy} onPress={() => void applyOverwrite()}>
              {t('rentals.verifyStart', 'Verify start')}
            </Button>
          </Dialog.Actions>
        </Dialog>

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
                  const parts = localDateTimeParts(new Date(booking.end_at));
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
  const due = formatListingDue(booking.end_at, i18n.language);
  const paid = formatRequestAmount(Number(booking.total_amount) || 0, booking.currency, i18n.language);
  const units = booking.units_booked || submittedUnits;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center' }]}>
        {started
          ? t('rentalInspection.startedTitle', 'Started, hand over the item')
          : t('rentalInspection.waitingTitle', 'Waiting for the renter to accept')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
        {started
          ? t('rentalInspection.startedBody', '{{name}} accepted the condition and the rental is in progress. Return is due by {{due}}.', { name, due })
          : t('rentalInspection.waitingBody', "{{name}} is reviewing the condition report. You'll see when the rental starts — then hand over the item.", { name })}
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
            {t('rentalInspection.noPinNote', 'Pickup photos submitted · {{done}} of {{total}} units. No PIN is needed for this rental.', {
              done: submittedUnits,
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

function inspectionFailure(
  error: unknown,
  t: (key: string, fallback: string) => string
): string | null {
  const kind = classifyInspectionError(error);
  if (kind === 'conflict') {
    return t('rentalInspection.reportChanged', 'That report changed. Review it again.');
  }
  if (kind === 'update_required') {
    return t(
      'rentalInspection.updateRequired',
      'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.'
    );
  }
  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
