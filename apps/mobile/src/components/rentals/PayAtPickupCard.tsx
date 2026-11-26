import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  cardDueAtPickup,
  dueAtPickup,
  feeOutcome,
  pickupDepositHold,
  reservationFee,
  type PayAtPickupFields,
} from '../../utils/rentals/reservationFee';

interface Props {
  booking: PayAtPickupFields;
  format: (value: number) => string;
  /** The business photographs the item and the renter checks it before paying. */
  itemCheck: boolean;
  pickupDay: string;
}

/** Booking detail (02): what is paid, what is due at pickup, and the fee rules. */
export function PayAtPickupCard({ booking, format, itemCheck, pickupDay }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const total = Number(booking.total_amount) || 0;
  const fee = reservationFee(booking);
  const outcome = feeOutcome(booking);
  const deposit = cardDueAtPickup(booking) ? pickupDepositHold(booking) : 0;
  const due = dueAtPickup(booking);
  return (
    <View
      testID="pay-at-pickup-card"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.xs }]}
    >
      <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '800', letterSpacing: 0.5 }]}>
        {t('rentals.payAtPickup.paymentHeading', 'PAYMENT')}
      </Text>
      <Row label={t('rentals.payAtPickup.rentalTotal', 'Rental total')} value={format(total)} />
      {fee > 0 ? (
        <Row
          label={
            outcome === 'paid' || outcome === 'applied'
              ? t('rentals.payAtPickup.feePaid', 'Paid · reservation fee')
              : t('rentals.payAtPickup.feeWaiting', 'Reservation fee · waiting for payment')
          }
          value={format(fee)}
          tone={outcome === 'paid' || outcome === 'applied' ? colors.success.dark ?? colors.success.main : undefined}
        />
      ) : null}
      <Row label={t('rentals.payAtPickup.dueAfterCheck', 'Due at pickup, after the item check')} value={format(due)} strong />
      {deposit > 0 ? (
        <Row label={t('rentals.payAtPickup.depositAtPickup', 'Deposit hold on your card at pickup')} value={format(deposit)} />
      ) : null}
      <IconLine icon="information-outline" text={t('rentals.payAtPickup.nothingElse', 'Nothing else is charged until you’ve seen the item.')} />
      {itemCheck ? (
        <View style={[styles.badge, { backgroundColor: colors.primary.main + '14', borderRadius: 999 }]}>
          <MaterialCommunityIcons name="camera-outline" size={14} color={colors.primary.main} />
          <Text style={[typography.caption, { color: colors.primary.main, fontWeight: '700', marginLeft: 4 }]}>
            {t('rentals.payAtPickup.itemCheck', 'Item check required')}
          </Text>
        </View>
      ) : null}
      {booking.status === 'reserved' && booking.payment_status !== 'paid' && booking.payment_status !== 'authorized' ? (
        <IconLine
          icon="clock-outline"
          text={
            fee > 0
              ? t('rentals.payAtPickup.comeByFee', 'Come by 23:59 on {{day}}. If you don’t, the reservation is cancelled and the business keeps the fee.', { day: pickupDay })
              : t('rentals.payAtPickup.comeBy', 'Come by 23:59 on {{day}}. If you don’t, the reservation is cancelled.', { day: pickupDay })
          }
        />
      ) : null}
      {fee > 0 ? (
        <>
          <IconLine icon="cash-refund" text={t('rentals.payAtPickup.feeRefunded', 'Fee refunded if you cancel before {{day}}, if the business cancels, or if the item doesn’t match.', { day: pickupDay })} />
          <IconLine icon="alert-circle-outline" text={t('rentals.payAtPickup.feeKept', 'Fee kept if you cancel on the pickup day or don’t come.')} />
        </>
      ) : null}
    </View>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.body2, { color: colors.text.secondary, flex: 1, paddingRight: 8 }]}>{label}</Text>
      <Text style={[typography.body2, { color: tone ?? colors.text.primary, fontWeight: strong ? '800' : '700' }]}>{value}</Text>
    </View>
  );
}

function IconLine({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.row, { alignItems: 'flex-start', marginTop: 4 }]}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.text.secondary} style={{ marginTop: 2 }} />
      <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 6, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
});
