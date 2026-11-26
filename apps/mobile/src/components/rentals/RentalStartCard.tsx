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
  formatZonedWeekday,
  formatZonedWhen,
  pickupPhase,
  type PickupPhase,
} from '../../utils/rentals/rentalStartWindow';

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
  authorized_amount?: number | string | null;
  security_deposit_amount?: number | string | null;
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
  const day = formatZonedDay(props.booking.start_at, BOOKING_CLOCK, i18n.language);
  const when = `${formatZonedWeekday(props.booking.start_at, BOOKING_CLOCK, i18n.language)} ${day}`;
  const time = formatZonedTime(props.booking.start_at, BOOKING_CLOCK);
  const pill = pillText(props.phase, day, t);
  const momo = isMomoDue(props.booking);
  const tone = props.phase === 'late' ? colors.warning : colors.success;
  return (
    <View style={[styles.card, { backgroundColor: tone.main + '14', borderColor: tone.main + '44', borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm }]}>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: tone.main + '22' }]}>
          <Text style={[typography.caption, { color: tone.dark ?? tone.main, fontWeight: '700' }]}>{pill}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 8 }]}>{t('rentals.nextStep.label', 'NEXT STEP')}</Text>
      </View>
      <Text style={[typography.h6, { color: colors.text.primary }]}>{titleFor(props.phase, when, time, props, t)}</Text>
      <Text style={[typography.body2, { color: colors.text.secondary }]}>{bodyFor(props, momo, t)}</Text>
      <LateLine {...props} />
      <MoneyLine {...props} momo={momo} />
      <Text style={[typography.body2, { color: colors.text.primary }]}>
        {t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })}
      </Text>
      <StartButton {...props} day={day} momo={momo} />
      <NotCollected {...props} />
      {props.phase === 'started' && props.role === 'client' ? props.missing : null}
    </View>
  );
}

function MoneyLine({ booking, money, momo, role }: Props & { momo: boolean }) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  if (role === 'business' || booking.status === 'active' || booking.actual_start_at) return null;
  const label = momo
    ? t('rentals.start.momoLine', 'Mobile Money · {{amount}}', { amount: money })
    : t('rentals.start.held', '{{amount}} held on your card', { amount: money });
  return <Text style={[typography.body2, { color: colors.text.primary }]}>{label}</Text>;
}

function StartButton(props: Props & { phase: PickupPhase; day: string; momo: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (props.role === 'business' || props.phase === 'started') return null;
  const locked = props.phase === 'before' || props.phase === 'closed';
  const amount = props.momo ? ` · ${props.money}` : '';
  const label = locked
    ? t('rentals.start.locked', 'Start rental · from {{day}}', { day: props.day })
    : t('rentals.start.button', 'Start rental{{amount}}', { amount });
  return (
    <Button
      mode="contained"
      icon={locked ? 'lock' : 'play'}
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

function confirmLabel(props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string): string {
  if (!isMomoDue(props.booking)) return t('rentals.actions.startRental', 'Start rental');
  return t('rentals.start.button', 'Start rental{{amount}}', { amount: ` · ${props.money}` });
}

function sheetMoney(props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string): string {
  if (isMomoDue(props.booking)) return t('rentals.start.momoLine', 'Mobile Money · {{amount}}', { amount: props.money });
  return t('rentals.start.held', '{{amount}} held on your card', { amount: props.money });
}

function LateLine(props: Props & { phase: PickupPhase }) {
  const { t, i18n } = useTranslation();
  const { colors, typography } = useTheme();
  if (props.phase !== 'late') return null;
  const booked = formatZonedTime(props.booking.start_at, BOOKING_CLOCK);
  const until = formatZonedWhen(props.booking.end_at, BOOKING_CLOCK, i18n.language);
  return (
    <Text style={[typography.body2, { color: colors.text.primary }]}>
      {t('rentals.start.lateStill', 'Booked for {{time}} · you can still start until {{until}}', { time: booked, until })}
    </Text>
  );
}

function ConfirmSheet(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]} onPress={() => undefined}>
          <MaterialCommunityIcons name="store" size={28} color={colors.primary.main} style={{ alignSelf: 'center' }} />
          <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center', marginTop: 8 }]}>{t('rentals.start.confirmTitle', 'Start rental?')}</Text>
          <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: 8 }]}>
            {t('rentals.start.confirmBody', 'Only start once you are with the business. The business will hand over the item once you start.')}
          </Text>
          <SheetRow icon="store" label={props.place} />
          <SheetRow icon="calendar-clock" label={t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })} />
          <SheetRow icon={isMomoDue(props.booking) ? 'cellphone' : 'credit-card-outline'} label={sheetMoney(props, t)} />
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 8 }]}>
            {t('rentals.start.didntHint', "Didn't get the item after starting? You can tell us within 30 minutes.")}
          </Text>
          <Button mode="contained" icon="play" buttonColor={colors.primary.main} loading={props.starting} onPress={props.onConfirm} style={{ marginTop: 16, minHeight: 48 }}>
            {confirmLabel(props, t)}
          </Button>
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

function titleFor(phase: PickupPhase, when: string, time: string, props: Props, t: (key: string, fallback: string, vars?: Record<string, string>) => string): string {
  if (props.role === 'business' && phase !== 'started') {
    return t('rentals.business.waitingTitle', 'Waiting for {{name}} to start', { name: props.renterName || t('rentals.renter', 'the renter') });
  }
  if (phase === 'started') {
    const at = props.booking.actual_start_at ? formatZonedTime(props.booking.actual_start_at, props.timeZone) : time;
    return props.role === 'business'
      ? t('rentals.business.startedLine', 'Started at {{time}} · hand over the item', { time: at })
      : t('rentals.start.startedBanner', 'Rental started at {{time}}. The business has been notified to hand over the item.', { time: at });
  }
  if (phase === 'before') return t('rentals.start.pickupOn', 'Pickup on {{when}} · {{time}}', { when, time });
  return t('rentals.start.todayTitle', 'Pick up your item · {{time}}', { time });
}

function bodyFor(props: Props & { phase: PickupPhase }, momo: boolean, t: (key: string, fallback: string) => string): string {
  if (props.role === 'business' && props.phase !== 'started') {
    return t('rentals.business.waitingBody', 'Hand over the item only after you get “Rental started”. No PIN needed.');
  }
  if (props.phase === 'started') return '';
  if (props.phase === 'before') return t('rentals.start.beforeBody', 'You can start the rental on the pickup day, once you are at the business.');
  if (momo) return t('rentals.start.momoBody', 'At the business, tap Start rental. You pay then, and they hand over the item once the payment goes through.');
  return t('rentals.start.todayBody', 'At the business, tap Start rental. They hand over the item once you start.');
}

function isMomoDue(booking: StartCardBooking): boolean {
  const code = booking.currency.toUpperCase();
  const momo = code === 'XAF' || code === 'XOF';
  return momo && booking.payment_status !== 'paid' && booking.payment_status !== 'authorized';
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { gap: 4 },
});
