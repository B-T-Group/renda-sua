import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  formatZonedDay,
  BOOKING_CLOCK,
  formatZonedTime,
  formatZonedWeekdayDay,
  formatZonedWhen,
  pickupPhase,
  type PickupPhase,
} from '../../utils/rentals/rentalStartWindow';
import { formatConfirmationMoney } from '../../utils/rentals/confirmationFormat';
import { startMoney, startMoneyLines, type StartMoneyBooking } from '../../utils/rentals/startMoney';
import { earlyReturnLine, earlyReturnPreview } from '../../utils/rentals/returnDue';
import { waitingForRenterTitle } from '../../utils/rentals/frenchElision';
import { payBreakdown } from '../../utils/rentals/payBreakdown';
import { PayBreakdownView, PayFooter } from './PayBreakdownView';

export interface StartCardBooking {
  status: string;
  start_at: string;
  end_at: string;
  start_opens_at?: string | null;
  actual_start_at?: string | null;
  currency: string;
  total_amount: number;
  payment_status?: string | null;
  payment_timing?: string | null;
  card_pay_at_pickup?: boolean | null;
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
  authorized_amount?: number | string | null;
  security_deposit_amount?: number | string | null;
  accept_start_preview?: StartMoneyBooking['accept_start_preview'];
  return_due_at?: string | null;
  rental_pricing_snapshot?: unknown;
}

interface Props {
  booking: StartCardBooking;
  timeZone: string;
  role: 'client' | 'business';
  renterName?: string;
  place: string;
  money: string;
  returnLabel: string;
  starting?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onNotCollected?: () => void;
  now?: number;
  missing?: React.ReactNode;
}

export function RentalStartCard(props: Props) {
  const phase = cardPhase(props);
  if (phase === 'closed' && props.role === 'client') return null;
  return (
    <View>
      <StartBody {...props} phase={phase} />
      <ConfirmSheet {...props} />
    </View>
  );
}

function cardPhase(props: Props): PickupPhase {
  const started = props.booking.status === 'active' || Boolean(props.booking.actual_start_at);
  return pickupPhase({
    now: props.now ?? Date.now(),
    startAt: props.booking.start_at,
    endAt: props.booking.end_at,
    startOpensAt: props.booking.start_opens_at,
    timeZone: props.timeZone,
    started,
  });
}

function StartBody(props: Props & { phase: PickupPhase }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const when = formatZonedWeekdayDay(props.booking.start_at, BOOKING_CLOCK, i18n.language);
  const time = formatZonedTime(props.booking.start_at, BOOKING_CLOCK, i18n.language, props.timeZone);
  const pill = pillText(props.phase, when, t);
  const momo = isMomoDue(props.booking);
  const card = isCardDue(props.booking);
  const tone = props.phase === 'late' ? colors.warning : colors.success;
  const body = bodyFor(props, momo, t, card);
  return (
    <View style={[styles.card, { backgroundColor: tone.main + '14', borderColor: tone.main + '44', borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm }]}>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: tone.main + '22' }]}>
          <Text style={[typography.caption, { color: tone.dark ?? tone.main, fontWeight: '700' }]}>{pill}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 8 }]}>{t('rentals.nextStep.label', 'NEXT STEP')}</Text>
      </View>
      <Text style={[typography.h6, { color: colors.text.primary }]}>{titleFor(props.phase, when, time, props, t, i18n.language)}</Text>
      {body ? <Text style={[typography.body2, { color: colors.text.secondary }]}>{body}</Text> : null}
      <LateLine {...props} />
      <MoneyLine {...props} momo={momo} />
      <Text style={[typography.body2, { color: colors.text.primary }]}>{cardReturnLine(props, t, i18n.language)}</Text>
      <StartButton {...props} day={when} momo={momo} card={card} />
      <NotCollected {...props} />
      {props.phase === 'started' && props.role === 'client' ? props.missing : null}
    </View>
  );
}

function MoneyLine({ booking, role }: Props & { momo: boolean }) {
  const { colors, typography } = useTheme();
  const lines = useStartMoneyLines(booking);
  if (role === 'business' || booking.status === 'active' || booking.actual_start_at) return null;
  return (
    <View testID="rental-start-money">
      <Text style={[typography.body2, { color: colors.text.primary }]}>{lines.main}</Text>
      {lines.sub ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{lines.sub}</Text> : null}
    </View>
  );
}

/** Held or paid amount from the server booking fields, formatted with the confirmation formatter. */
function useStartMoneyLines(booking: StartCardBooking) {
  const { t, i18n } = useTranslation();
  const format = (value: number) => formatConfirmationMoney(value, booking.currency, i18n.language);
  return startMoneyLines(startMoney(booking), format, t);
}

const MONEY_ICONS = { card: 'credit-card-outline', momo: 'cellphone', wallet: 'wallet-outline' } as const;

function SheetMoney({ booking }: { booking: StartCardBooking }) {
  const { colors, typography } = useTheme();
  const lines = useStartMoneyLines(booking);
  return (
    <View testID="rental-start-sheet-money" style={[styles.row, { alignItems: 'flex-start' }]}>
      <MaterialCommunityIcons name={MONEY_ICONS[lines.icon]} size={18} color={colors.text.secondary} style={{ marginTop: 2 }} />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[typography.body2, { color: colors.text.primary }]}>{lines.main}</Text>
        {lines.sub ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{lines.sub}</Text> : null}
      </View>
    </View>
  );
}

function StartButton(props: Props & { phase: PickupPhase; day: string; momo: boolean; card: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (props.role === 'business' || props.phase === 'started') return null;
  const locked = props.phase === 'before' || props.phase === 'closed';
  const label = locked
    ? t('rentals.start.pickupOpens', 'Pickup opens {{day}}', { day: props.day })
    : props.card || props.momo
      ? t('rentals.payAtPickup.payAndStart', 'Pay & start · {{amount}}', { amount: props.money })
      : t('rentals.start.button', 'Start rental{{amount}}', { amount: '' });
  return (
    <Button
      mode="contained"
      icon={locked ? 'lock' : props.card ? 'credit-card-outline' : props.momo ? 'cellphone' : 'play'}
      disabled={locked || props.starting}
      loading={props.starting}
      buttonColor={locked ? colors.text.disabled : colors.primary.main}
      onPress={props.onOpen}
      style={{ minHeight: 48 }}
    >
      {label}
    </Button>
  );
}

function NotCollected(props: Props & { phase: PickupPhase }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (props.role !== 'business' || props.phase !== 'started' || !props.onNotCollected) return null;
  return (
    <Button icon="help-circle-outline" textColor={colors.error.main} onPress={props.onNotCollected}>
      {t('rentals.business.notCollected', 'Item not collected?')}
    </Button>
  );
}

function SheetRow({ icon, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  const { colors, typography } = useTheme();
  if (!label) return null;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.text.secondary} />
      <Text style={[typography.body2, { color: colors.text.primary, marginLeft: 8, flex: 1 }]}>{label}</Text>
    </View>
  );
}

/** The sheet's one pay label (the card uses "Pay & start · …"). */
function confirmLabel(props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string): string {
  if (isCardDue(props.booking) || isMomoDue(props.booking)) return t('rentals.payAtPickup.payButton', 'Pay {{amount}} · start rental', { amount: props.money });
  return t('rentals.actions.startRental', 'Start rental');
}

function LateLine(props: Props & { phase: PickupPhase }) {
  const { t, i18n } = useTranslation();
  const { colors, typography } = useTheme();
  if (props.phase !== 'late') return null;
  const booked = formatZonedTime(props.booking.start_at, BOOKING_CLOCK, i18n.language, props.timeZone);
  const until = formatZonedWhen(props.booking.end_at, BOOKING_CLOCK, i18n.language, props.timeZone);
  return (
    <Text style={[typography.body2, { color: colors.text.primary }]}>
      {t('rentals.start.lateStill', 'Booked for {{time}} · you can still start until {{until}}', { time: booked, until })}
    </Text>
  );
}

/**
 * Card return line. Business: only "Booked 2:00 PM – 4:00 PM" before the start, then
 * "Return by …" / "Retour prévu le …" (the due time). Renter: "Return by …" / "Retournez avant le …".
 */
function cardReturnLine(props: Props & { phase: PickupPhase }, t: (key: string, fallback: string, vars?: Record<string, string>) => string, language: string): string {
  if (props.role === 'business' && props.phase !== 'started') return bookedWindow(props, t, language);
  if (props.role === 'business') return t('rentals.start.returnDueBusiness', 'Return by {{when}}', { when: props.returnLabel });
  return t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel });
}

/** Business before the start: the booked window ("Booked 2:00 PM – 4:00 PM"), no early preview. */
function bookedWindow(props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string, language: string): string {
  return t('rentals.start.bookedWindow', 'Booked {{start}} – {{end}}', {
    start: formatZonedTime(props.booking.start_at, BOOKING_CLOCK, language, props.timeZone),
    end: formatZonedTime(props.booking.end_at, BOOKING_CLOCK, language, props.timeZone),
  });
}

/** Renter Start sheet, hourly early start: the due time if the renter starts now. Otherwise the booked return. */
function returnLine(props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string, language: string): string {
  const preview = earlyReturnPreview(props.booking, props.now ?? Date.now(), props.timeZone);
  if (preview) return earlyReturnLine(preview, language, t);
  return t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel });
}

function ConfirmSheet(props: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const card = isCardDue(props.booking);
  const pays = card || isMomoDue(props.booking);
  const breakdown = pays ? payBreakdown(props.booking, i18n.language, t) : null;
  const hero = card ? 'credit-card-outline' : pays ? 'cellphone' : 'store';
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]} onPress={() => undefined}>
          <View testID="rental-start-sheet-hero" style={[styles.hero, { backgroundColor: colors.primaryTint }]}>
            <MaterialCommunityIcons name={hero} size={28} color={colors.primary.main} />
          </View>
          <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center', marginTop: 8 }]}>{pays ? t('rentals.payAtPickup.payTitle', 'Pay and start') : t('rentals.start.confirmTitle', 'Start rental?')}</Text>
          <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: 8 }]}>
            {pays
              ? t('rentals.payAtPickup.payBody', 'Pay now and the business hands you the item. The rental starts when the payment goes through.')
              : t('rentals.start.confirmBody', 'Only start once you are with the business. The business will hand over the item once you start.')}
          </Text>
          <SheetRow icon="store" label={props.place} />
          <SheetRow icon="calendar-clock" label={returnLine(props, t, i18n.language)} />
          {breakdown ? <PayBreakdownView breakdown={breakdown} /> : <SheetMoney booking={props.booking} />}
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 8 }]}>
            {t('rentals.start.didntHint', "Didn't get the item after starting? You can tell us within 30\u00a0minutes.")}
          </Text>
          <Button mode="contained" icon={card ? 'lock-outline' : pays ? 'cellphone' : 'play'} buttonColor={colors.primary.main} loading={props.starting} onPress={props.onConfirm} style={{ marginTop: 16, minHeight: 48 }}>
            {confirmLabel(props, t)}
          </Button>
          {breakdown ? <PayFooter breakdown={breakdown} /> : null}
          <Button onPress={props.onClose}>{t('rentals.start.notYet', 'Not yet')}</Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function pillText(phase: PickupPhase, day: string, t: (key: string, fallback: string, vars?: Record<string, string>) => string): string {
  if (phase === 'before') return t('rentals.start.pillDay', 'Pickup {{day}}', { day });
  if (phase === 'late') return t('rentals.start.latePickup', 'Late pickup');
  if (phase === 'started') return t('rentals.journey.inProgress', 'In progress');
  return t('rentals.start.pickupToday', 'Pickup today');
}

function titleFor(phase: PickupPhase, when: string, time: string, props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string, language: string): string {
  if (props.role === 'business' && phase !== 'started') {
    return waitingForRenterTitle(props.renterName || t('rentals.renter', 'the renter'), language, t);
  }
  if (phase === 'started') {
    const at = props.booking.actual_start_at ? formatZonedTime(props.booking.actual_start_at, props.timeZone, language, props.timeZone) : time;
    if (props.role === 'business' && props.booking.payment_timing === 'pay_at_pickup') {
      return t('rentals.payAtPickup.businessPaid', 'Paid at {{time}} · hand over the item', { time: at });
    }
    return props.role === 'business'
      ? t('rentals.business.startedLine', 'Started at {{time}} · hand over the item', { time: at })
      : t('rentals.start.startedBanner', 'Rental started at {{time}}. The business has been notified to hand over the item.', { time: at });
  }
  if (phase === 'before') return t('rentals.start.pickupOn', 'Pickup on {{when}} · {{time}}', { when, time });
  return t('rentals.start.todayTitle', 'Pick up your item · {{time}}', { time });
}

function bodyFor(props: Props & { phase: PickupPhase }, momo: boolean, t: (key: string, fallback: string) => string, card = false): string {
  if (props.role === 'business' && props.phase !== 'started' && props.booking.payment_timing === 'pay_at_pickup') {
    return t('rentals.payAtPickup.businessWaitingBody', 'The renter checks the item and pays here. Don’t hand over the item until you see “Paid”.');
  }
  if (props.role === 'business' && props.phase !== 'started') {
    return t('rentals.business.waitingBody', 'Hand over the item only after you get “Rental started”. No PIN needed.');
  }
  if (props.phase === 'started') return '';
  if (props.phase === 'before') return t('rentals.start.beforeBody', 'You can start the rental on the pickup day, once you are at the business.');
  if (card || momo) return t('rentals.payAtPickup.cardBody', 'At the business, check the item, then tap Pay & start. They hand over the item once the payment goes through.');
  if (momo) return t('rentals.start.momoBody', 'At the business, tap Start rental. You pay then, and they hand over the item once the payment goes through.');
  return t('rentals.start.todayBody', 'At the business, tap Start rental. They hand over the item once you start.');
}

function isMomoDue(booking: StartCardBooking): boolean {
  return startMoney(booking).kind === 'momo_due';
}

function isCardDue(booking: StartCardBooking): boolean {
  return startMoney(booking).kind === 'card_due';
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  hero: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { gap: 4 },
});
