import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PayWaitingPanel } from '../../components/rentals/inspection/PayWaitingPanel';
import { payBreakdown } from '../../utils/rentals/payBreakdown';
import { InspectionBanner, UnitTabs } from '../../components/rentals/inspection/InspectionChrome';
import { InspectionPhotoSlots } from '../../components/rentals/inspection/InspectionPhotoSlots';
import { DeclineConditionSheet } from '../../components/rentals/DeclinePickupScreens';
import { PickupStartFlow } from '../../components/rentals/inspection/PickupStartFlow';
import { RentalStartedConfirmation } from '../../components/rentals/inspection/RentalStartedConfirmation';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientInspection } from '../../hooks/useClientInspection';
import type { ClientRootStackParamList } from '../../navigation/types';
import { trackSiteEvent } from '../../services/analytics/AppEventsService';
import { getBooking, getPaymentStatus, startRental } from '../../services/rentalsApi';
import { settlePickupCardPayment, useRentalStripePayment } from '../../hooks/useRentalStripePayment';
import { BOOKING_CLOCK, formatZonedWhen } from '../../utils/rentals/rentalStartWindow';
import { bookingReturnDue, earlyReturnPreview, formatReturnClock } from '../../utils/rentals/returnDue';
import { formatListingDay } from '../../utils/rentals/pickupPhotoTime';
import { showsCardDeposit } from '../../utils/rentals/cardDeposit';
import {
  confirmationDepositHeld,
  confirmationTimeZone,
  confirmationZoneDefault,
  confirmationZoneKey,
  formatConfirmationDue,
  formatConfirmationMoney,
} from '../../utils/rentals/confirmationFormat';
import { startMoney, startMoneyLines } from '../../utils/rentals/startMoney';
import { CORRECTION_REASON_CODES, allUnitsReviewed, classifyInspectionError, damageRail, returnHasDamage } from '../../utils/rentals/rentalInspection';

type Route = RouteProp<ClientRootStackParamList, 'ClientInspection'>;

export default function ClientInspectionScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const { flags, loading: flagsLoading } = useClientFlags();
  const confirmationsOn = !flagsLoading && flags.rentals_inspection_confirmations_enabled;
  const [started, setStarted] = useState<null | { momo: boolean }>(null);
  const [startRail, setStartRail] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { bookingId, stage } = useRoute<Route>().params;
  const model = useClientInspection(bookingId, stage);
  const { pay: payWithSheet } = useRentalStripePayment();
  const [panel, setPanel] = useState<'review' | 'correction' | 'dispute'>('review');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [momoPhase, setMomoPhase] = useState<'waiting' | 'failed' | 'stalled' | null>(null);
  const [notice, setNotice] = useState<'conflict' | 'update_required' | 'unavailable' | null>(null);
  const waitingSince = useRef<number | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const ids = model.view?.units.map((unit) => unit.unitId) ?? [];
  const reviewed = allUnitsReviewed(ids, model.seen);
  const unit = model.view?.units[model.index];
  const damaged = stage === 'return' && returnHasDamage(model.view);
  const rail = model.booking ? damageRail(model.booking) : 'recorded';

  const reasonLabels = useMemo(() => ({
    missing_accessory: t('rentalInspection.reasonMissingAccessory', 'Missing accessory'),
    photo_mismatch: t('rentalInspection.reasonPhotoMismatch', "Photo doesn't match item"),
    wear_hidden: t('rentalInspection.reasonWearHidden', 'Wear not shown'),
    wrong_unit: t('rentalInspection.reasonWrongUnit', 'Wrong unit / serial'),
  }), [t]);

  const preview = model.booking?.accept_start_preview;
  const amountDue = preview?.amount_due_at_pickup ?? 0;
  const shownAmount = amountDue > 0 ? amountDue : Number(model.booking?.total_amount) || 0;
  const amountLabel = formatConfirmationMoney(shownAmount, model.booking?.currency ?? 'XAF', i18n.language);
  const money = model.booking ? startMoney(model.booking) : null;
  const cardAtPickup = money?.kind === 'card_due';
  const payAtStep = money?.kind === 'card_due' || money?.kind === 'momo_due' || money?.kind === 'wallet_due';
  const moneyLines = model.booking && money
    ? startMoneyLines(
        money,
        (value) => formatConfirmationMoney(value, model.booking?.currency ?? 'XAF', i18n.language),
        t
      )
    : undefined;
  const breakdown = model.booking && payAtStep ? payBreakdown(model.booking, i18n.language, t) : null;
  const photoZone = confirmationTimeZone(
    model.booking?.rental_location_listing?.business_location?.address?.country,
    model.booking?.currency
  );
  const dueAt = bookingReturnDue(model.booking);
  const dueLabel = dueAt ? formatZonedWhen(dueAt, BOOKING_CLOCK, i18n.language, photoZone) : '';
  // Hourly early start: due at start + booked hours if the renter starts now.
  const earlyDue = earlyReturnPreview(model.booking, Date.now(), photoZone);
  const sheetDueLabel = earlyDue ? formatReturnClock(earlyDue.dueAt, i18n.language, photoZone) : dueLabel;
  const pickupStart = stage === 'pickup' && !damaged;

  useEffect(() => {
    if (momoPhase !== 'waiting') {
      waitingSince.current = null;
      return undefined;
    }
    if (waitingSince.current == null) waitingSince.current = Date.now();
    let stop = false;
    const tick = async () => {
      const row = await getBooking(bookingId);
      if (stop || !row) return;
      if (row.status === 'active' || row.actual_start_at) {
        if (confirmationsOn) {
          setMomoPhase(null);
          setStarted({ momo: startRail === 'mobile_money' });
          return;
        }
        navigation.goBack();
        return;
      }
      const pay = await getPaymentStatus(bookingId).catch(() => null);
      if (startRail !== 'card' && pay && !pay.paymentPending && row.status === 'reserved') {
        setMomoPhase('failed');
        return;
      }
      const waited = Date.now() - (waitingSince.current ?? Date.now());
      if (startRail === 'card' && row.status === 'reserved' && row.payment_status !== 'authorized' && waited >= 90_000) {
        setMomoPhase('failed');
        return;
      }
      if (pay && !pay.paymentPending && row.status === 'confirmed' && !row.actual_start_at && waited >= 60_000) {
        setMomoPhase('stalled');
      }
    };
    const timer = setInterval(() => void tick(), 4000);
    void tick();
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [bookingId, confirmationsOn, momoPhase, navigation, startRail]);

  const confirmStart = async () => {
    if (!model.view?.versionId) return;
    trackSiteEvent({
      eventType: 'rental_accept_and_start_tap',
      subjectType: 'rental_booking',
      subjectId: bookingId,
      metadata: {
        payment_rail: preview?.payment_rail ?? 'unknown',
        amount_due_at_pickup: amountDue,
        is_retry: momoPhase === 'failed' || momoPhase === 'stalled',
      },
    });
    setStarting(true);
    try {
      const result = await startRental(bookingId, cardAtPickup ? { stripe_payment_method: 'payment_sheet' } : undefined);
      setConfirmOpen(false);
      setNotice(null);
      if (cardAtPickup && result.paymentPending) {
        // Card pay at pickup: the rental starts when the card authorization webhook lands.
        setStartRail('card');
        const outcome = await settlePickupCardPayment(result, payWithSheet);
        if (outcome === 'cancelled' || outcome === 'failed') {
          setMomoPhase('failed');
          return;
        }
        setMomoPhase('waiting');
        return;
      }
      if (result.paymentPending) {
        setStartRail(result.payment_rail ?? 'mobile_money');
        setMomoPhase('waiting');
        return;
      }
      if (confirmationsOn) {
        setStarted({ momo: false });
        return;
      }
      navigation.goBack();
    } catch (error: unknown) {
      setConfirmOpen(false);
      const kind = classifyInspectionError(error);
      if (kind === 'conflict' || kind === 'update_required' || kind === 'unavailable') {
        setMomoPhase(null);
        setNotice(kind);
      } else if (preview?.payment_rail === 'mobile_money') {
        setNotice(null);
        setMomoPhase('failed');
      } else {
        setMomoPhase(null);
        setNotice('unavailable');
      }
      await model.reload();
    } finally {
      setStarting(false);
    }
  };

  if (started && model.booking) {
    const country = model.booking.rental_location_listing?.business_location?.address?.country;
    const due = formatConfirmationDue(bookingReturnDue(model.booking) ?? model.booking.end_at, BOOKING_CLOCK, i18n.language);
    const paid = formatConfirmationMoney(Number(model.booking.total_amount) || 0, model.booking.currency, i18n.language);
    const depositAmount = Number(model.booking.security_deposit_amount) || 0;
    const deposit = depositAmount > 0 && showsCardDeposit(model.booking.currency)
      ? formatConfirmationMoney(depositAmount, model.booking.currency, i18n.language)
      : '';
    return (
      <RentalStartedConfirmation
        momo={started.momo}
        due={due}
        zone={t(confirmationZoneKey(country, model.booking.currency), confirmationZoneDefault(country, model.booking.currency, i18n.language))}
        paid={paid}
        deposit={deposit}
        depositHeld={confirmationDepositHeld(model.booking.payment_status)}
        title={model.booking.rental_location_listing?.rental_item?.name || t('rentals.booking', 'Rental')}
        startAt={model.booking.start_at}
        endAt={bookingReturnDue(model.booking) ?? model.booking.end_at}
        location={model.booking.rental_location_listing?.business_location?.name}
        onBack={() => navigation.goBack()}
      />
    );
  }

  if (momoPhase) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <PayWaitingPanel
          phase={momoPhase}
          rail={startRail === 'card' ? 'card' : money?.kind === 'wallet_due' ? 'wallet' : 'momo'}
          breakdown={breakdown}
          place={model.booking?.rental_location_listing?.business_location?.name ?? ''}
          timeZone={photoZone}
          starting={starting}
          onRetry={() => void confirmStart()}
          onSupport={() => navigation.navigate('SupportTickets')}
        />
      </View>
    );
  }

  if (model.loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!unit || model.view?.status === 'not_ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.md }]}>
        <Text style={[typography.body1, { color: colors.text.primary, textAlign: 'center' }]}>
          {t('rentalInspection.businessRecording', 'The business is recording the condition report.')}
        </Text>
      </View>
    );
  }

  if (pickupStart && model.view && unit) {
    return (
      <View style={{ flex: 1 }}>
        <PickupStartFlow
          view={model.view}
          photos={unit.photos}
          timeZone={photoZone}
          itemName={model.booking?.rental_location_listing?.rental_item?.name ?? ''}
          bookingNumber={model.booking?.booking_number ?? ''}
          place={model.booking?.rental_location_listing?.business_location?.name ?? ''}
          returnLabel={dueLabel}
          money={amountLabel}
          moneyLines={moneyLines}
          startAt={model.booking?.start_at ?? ''}
          endAt={model.booking?.end_at ?? ''}
          pricingSnapshot={model.booking?.rental_pricing_snapshot}
          startOpensAt={model.booking?.start_opens_at}
          pay={payAtStep}
          breakdown={breakdown}
          busy={model.busy}
          starting={starting}
          showDecline={Boolean(flags.rentals_pickup_decline_enabled)}
          onMatch={() => void model.accept()}
          onAsk={(codes, note) => void model.sendReason('correction', codes, note, reasonLabels)}
          onDecline={() => setDeclineOpen(true)}
          onStart={() => void confirmStart()}
          onReport={() => navigation.navigate('SupportTickets')}
        />
        {declineOpen && model.booking ? (
          <DeclineConditionSheet money={declinePreview(model.booking)} onClose={() => setDeclineOpen(false)} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 140, gap: spacing.md }}>
        <Text style={[typography.h5, { color: colors.text.primary }]}>
          {stage === 'return'
            ? t('rentalInspection.reviewReturn', 'Review the return against pickup photos')
            : t('rentalInspection.reviewTitle', 'Review item condition')}
        </Text>
        <InspectionBanner tone="info">
          {t('rentalInspection.mustReviewAll', 'Review every unit before accepting. This locks the pickup baseline.')}
        </InspectionBanner>
        {notice === 'conflict' || model.error === 'conflict' ? (
          <InspectionBanner tone="warning">{t('rentalInspection.reportChanged', 'That report changed. Review it again.')}</InspectionBanner>
        ) : null}
        {notice === 'unavailable' ? (
          <InspectionBanner tone="warning">{t('rentalInspection.tryAgain', 'Something went wrong. Try again.')}</InspectionBanner>
        ) : null}
        {notice === 'update_required' || model.error === 'update_required' ? (
          <InspectionBanner tone="warning">
            {t('rentalInspection.updateRequired', 'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.')}
          </InspectionBanner>
        ) : null}
        <UnitTabs
          accent="client"
          labels={model.view?.units.map((row) => row.displayLabel) ?? []}
          active={model.index}
          done={model.view?.units.map((row) => model.seen.has(row.unitId)) ?? []}
          onSelect={model.setIndex}
        />
        <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
          {model.booking?.rental_location_listing?.rental_item?.name} · {unit.displayLabel}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('rentalInspection.reviewedProgress', '{{done}} of {{total}} reviewed', {
            done: model.seen.size,
            total: ids.length,
          })}
        </Text>
        {unit.photos.some((photo) => photo.reused) ? (
          <Text style={{ color: colors.text.secondary }}>
            {t('rentalInspection.reuseTransparency', 'Some photos come from an earlier rental. Each photo shows the date it was taken.')}
          </Text>
        ) : null}
        <View style={styles.photos}>
          {unit.photos.map((photo) => (
            <ReviewPhoto key={photo.id} photo={photo} zone={photoZone} language={i18n.language} />
          ))}
        </View>
        <Text style={{ color: colors.text.primary }}>{conditionLine(unit.condition, t)}</Text>
        <Text style={{ color: colors.text.primary }}>{wearLine(unit.wear, t)}</Text>
        {(model.view?.slotSkips ?? [])
          .filter((row) => row.unitId === unit.unitId)
          .map((row) => (
            <Text key={row.slotKey} style={{ color: colors.text.secondary }}>
              {t('rentalInspection.skippedAngle', 'Skipped {{angle}}: {{reason}}', {
                angle: row.slotKey.startsWith('extra:')
                  ? t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: row.slotKey.slice(6) })
                  : row.slotKey,
                reason: row.reason,
              })}
            </Text>
          ))}
        {unit.accessories.map((row) => (
          <Text key={row.name} style={{ color: colors.text.primary }}>{row.name} · {row.count}</Text>
        ))}
        {damaged ? (
          <InspectionBanner tone="warning">
            {rail === 'card'
              ? t('rentalInspection.cardAgree', 'If you agree, we capture {{amount}} from your card hold. Rent and overtime settle as usual.', {
                  amount: model.view?.claimedDamageAmount ?? '',
                })
              : t('rentalInspection.recordedAgree', 'If you agree, we record the claim only. No money moves automatically. Rendasua support resolves any payment. Rent and overtime settle as usual.')}
            {' '}
            {model.view?.claimedDamageAmount != null
              ? t('rentalInspection.claimedAmountShown', 'Claimed {{amount}}', { amount: model.view.claimedDamageAmount })
              : ''}
            {' '}
            {t('rentalInspection.respondSoon', 'Respond soon. Reminder in 24 hours. A person reviews it after 48 hours if you do not reply. A damage claim is never accepted automatically.')}
          </InspectionBanner>
        ) : null}
        {panel !== 'review' ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
              {panel === 'dispute'
                ? t('rentalInspection.reportDisagreement', 'Report a disagreement')
                : t('rentalInspection.correctionTitle', 'Request a correction')}
            </Text>
            {CORRECTION_REASON_CODES.map((code) => (
              <Pressable key={code} accessibilityRole="checkbox" accessibilityState={{ checked: reasons.includes(code) }} onPress={() => setReasons((prev) => prev.includes(code) ? prev.filter((row) => row !== code) : [...prev, code])} style={styles.check}>
                <Text style={{ color: colors.text.primary }}>{reasons.includes(code) ? '☑ ' : '☐ '}{reasonLabels[code]}</Text>
              </Pressable>
            ))}
            <TextInput mode="outlined" multiline label={t('rentalInspection.details', 'Details')} value={details} onChangeText={setDetails} />
            {panel === 'dispute' ? (
              <InspectionPhotoSlots
                slots={model.counterPhotos}
                minPhotos={null}
                onAdd={(_role, slot) => void model.addCounter(slot)}
                onRetry={(slot) => void model.retryCounter(slot)}
              />
            ) : null}
          </View>
        ) : null}
        {stage === 'return' && model.baselineMissing ? (
          <InspectionBanner tone="warning">
            {t('rentalInspection.pickupBaselineMissing', 'Pickup baseline unavailable for this rental')}
          </InspectionBanner>
        ) : null}
        {model.notice ? <InspectionBanner tone="success">{noticeText(model.notice, t)}</InspectionBanner> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }]}>
        {panel === 'review' ? (
          <>
            {pickupStart && amountDue > 0 ? (
              <View style={[styles.payLine, { backgroundColor: colors.infoTint, borderRadius: borderRadius.md }]}>
                <Text style={{ color: colors.text.primary, textAlign: 'center' }}>
                  {t('rentalInspection.payNow', "You'll pay {{amount}} now", { amount: amountLabel })}
                </Text>
              </View>
            ) : null}
            <Button
              mode="contained"
              buttonColor={colors.primary.main}
              style={styles.action}
              disabled={!reviewed || model.busy || starting || !model.view?.versionId}
              onPress={() => (pickupStart ? setConfirmOpen(true) : void model.accept())}
            >
              {damaged
                ? rail === 'card'
                  ? t('rentalInspection.agreeCapture', 'I agree · capture {{amount}}', { amount: model.view?.claimedDamageAmount ?? '' })
                  : t('rentalInspection.agreeRecord', 'I agree · record claim')
                : pickupStart
                  ? t('rentalInspection.acceptAndStart', 'Accept condition & start rental')
                  : t('rentalInspection.confirmNoDisagreement', 'Confirm · no disagreement')}
            </Button>
            <Button
              mode="outlined"
              textColor={pickupStart && !damaged ? colors.text.primary : colors.error.main}
              style={[styles.action, pickupStart && !damaged ? { borderColor: colors.border } : null]}
              onPress={() => setPanel(damaged ? 'dispute' : 'correction')}
            >
              {damaged
                ? t('rentalInspection.disputeClaim', 'Dispute this claim')
                : pickupStart
                  ? t('rentalInspection.reportProblem', 'Report a problem')
                  : t('rentalInspection.requestCorrection', 'Request a correction')}
            </Button>
            {pickupStart && flags.rentals_pickup_decline_enabled ? (
              <Button textColor={colors.error.main} onPress={() => setDeclineOpen(true)}>
                {t('pickupDecline.cta', 'Not as described? Decline')}
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            mode="contained"
            buttonColor={colors.primary.main}
            style={styles.action}
            disabled={model.busy || model.isOffline}
            onPress={() => void model.sendReason(panel === 'dispute' ? 'dispute' : 'correction', reasons, details, reasonLabels)}
          >
            {panel === 'dispute'
              ? t('rentalInspection.reportDisagreement', 'Report a disagreement')
              : t('rentalInspection.sendToBusiness', 'Send to business')}
          </Button>
        )}
      </View>
      {declineOpen && model.booking ? (
        <DeclineConditionSheet
          money={declinePreview(model.booking)}
          onClose={() => setDeclineOpen(false)}
        />
      ) : null}
      <Modal visible={confirmOpen} transparent animationType="none" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => !starting && setConfirmOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: '#FFFFFF', width: '100%', paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={[typography.h5, { color: colors.text.primary }]}>
              {t('rentalInspection.sheetTitle', 'Start this rental?')}
            </Text>
            <Text style={[typography.body1, { color: colors.text.secondary, marginTop: 8 }]}>
              {t('rentalInspection.sheetBody', 'The rental clock starts now. Return is due by {{due}}.', { due: sheetDueLabel })}
            </Text>
            {preview?.payment_rail === 'mobile_money' && amountDue > 0 ? (
              <View style={[styles.payLine, { backgroundColor: colors.infoTint, borderRadius: borderRadius.md, marginTop: 12 }]}>
                <Text style={{ color: colors.text.primary }}>
                  {t('rentalInspection.sheetMomo', "You'll pay {{amount}} by Mobile Money", { amount: amountLabel })}
                </Text>
              </View>
            ) : amountDue > 0 ? (
              <View style={[styles.payLine, { backgroundColor: colors.infoTint, borderRadius: borderRadius.md, marginTop: 12 }]}>
                <Text style={{ color: colors.text.primary }}>
                  {t('rentalInspection.payNow', "You'll pay {{amount}} now", { amount: amountLabel })}
                </Text>
              </View>
            ) : null}
            <Button mode="contained" buttonColor={colors.primary.main} style={[styles.action, { marginTop: 16 }]} loading={starting} onPress={() => void confirmStart()}>
              {t('rentalInspection.acceptAndStart', 'Accept condition & start rental')}
            </Button>
            <Button mode="text" textColor={colors.primary.main} style={[styles.action, { marginTop: 4 }]} onPress={() => setConfirmOpen(false)} disabled={starting}>
              {t('rentalInspection.sheetCancel', 'Cancel')}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ReviewPhoto({
  photo,
  zone,
  language,
}: {
  photo: { role: string; url?: string | null; reused?: boolean; captureSource?: string | null; capturedAt?: string | null };
  zone: string;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const origin = photo.reused ? t('rentalInspection.reusedBadge', 'Reused') : t('rentalInspection.newBadge', 'New');
  const day = photo.capturedAt ? formatListingDay(photo.capturedAt, zone, language) : '';
  return (
    <View style={styles.photo}>
      <ReviewFrame photo={photo} origin={origin} />
      <Text numberOfLines={1} style={[styles.role, { color: colors.text.primary }]}>{photoRoleLabel(photo.role, t)}</Text>
      {photo.captureSource || photo.reused ? <ReviewDate origin={origin} day={day} /> : null}
    </View>
  );
}

function ReviewFrame({
  photo,
  origin,
}: {
  photo: { url?: string | null; reused?: boolean };
  origin: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: colors.surfaceInput }]}>
      {photo.url ? <Image source={{ uri: photo.url }} style={styles.image} /> : null}
      {photo.reused ? (
        <View style={[styles.reused, { backgroundColor: colors.text.primary }]}>
          <Text style={styles.reusedText}>{origin}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewDate({ origin, day }: { origin: string; day: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <Text numberOfLines={1} style={[styles.metaWord, { color: colors.text.secondary }]}>{origin}</Text>
      {day ? <Text style={[styles.metaDate, { color: colors.text.secondary }]}>{` · ${day}`}</Text> : null}
    </View>
  );
}

function photoRoleLabel(role: string, t: (key: string, fallback: string) => string): string {
  if (role === 'overview') return t('rentalInspection.overview', 'Overview');
  if (role === 'other_side') return t('rentalInspection.otherSide', 'Other side');
  if (role === 'accessories') return t('rentalInspection.accessories', 'Accessories');
  return role;
}

function conditionLine(condition: string, t: (key: string, fallback: string) => string): string {
  if (condition === 'good') return t('rentalInspection.overallGood', 'Overall good');
  if (condition === 'fair') return t('rentalInspection.overallFair', 'Fair condition');
  if (condition === 'damaged') return t('rentalInspection.damageFound', 'Damage found');
  return condition;
}

function wearLine(wear: string, t: (key: string, fallback: string) => string): string {
  if (!wear || wear === 'none') return t('rentalInspection.noWear', 'No existing wear');
  return wear;
}

function declinePreview(booking: { currency: string; payment_status?: string | null; authorized_amount?: number | string | null; total_amount: number; booking_number?: string | null }) {
  const code = booking.currency.toUpperCase();
  const momo = code === 'XAF' || code === 'XOF';
  const authorized = Number(booking.authorized_amount) || 0;
  const rail = momo
    ? booking.payment_status === 'paid' ? 'momo_paid' as const : 'momo_unpaid' as const
    : authorized > 0 ? 'card' as const : 'wallet' as const;
  return {
    rail,
    amount: momo ? Number(booking.total_amount) || 0 : authorized,
    currency: booking.currency,
    timeZone: momo ? 'Africa/Douala' : 'America/Toronto',
    place: '',
    item: '',
    bookingNumber: booking.booking_number ?? '',
  };
}

function noticeText(notice: string, t: (key: string, fallback: string) => string): string {
  if (notice === 'accepted') return t('rentalInspection.accepted', 'You accepted this report.');
  if (notice === 'correction') return t('rentalInspection.correctionSent', 'Correction sent. The business will update the report.');
  if (notice === 'disputed') return t('rentalInspection.returnRecorded', 'Return recorded. Financial review pending.');
  return notice;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '31%' },
  frame: { height: 96, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: 96 },
  reused: { position: 'absolute', top: 4, right: 4, borderRadius: 4, paddingHorizontal: 4 },
  reusedText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  role: { textAlign: 'center', marginTop: 4, fontSize: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'center' },
  metaWord: { flexShrink: 1, fontSize: 11 },
  metaDate: { flexShrink: 0, fontSize: 11 },
  check: { minHeight: 48, justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  action: { minHeight: 48, justifyContent: 'center', width: '100%' },
  payLine: { padding: 12 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: '100%' },
});
