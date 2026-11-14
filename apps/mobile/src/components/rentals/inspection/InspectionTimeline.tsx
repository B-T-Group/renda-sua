import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { damageRail, type InspectionView } from '../../../utils/rentals/rentalInspection';

export interface TimelineBooking {
  status: string;
  start_at?: string | null;
  created_at?: string | null;
  actual_start_at?: string | null;
  return_handed_back_at?: string | null;
  return_resolution?: string | null;
  payment_status?: string | null;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  units_booked?: number | null;
}

export function InspectionTimeline({
  role,
  booking,
  pickup,
  returnView,
}: {
  role: 'client' | 'business';
  booking: TimelineBooking;
  pickup: InspectionView | null;
  returnView: InspectionView | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const started =
    !!booking.actual_start_at ||
    booking.status === 'active' ||
    booking.status === 'awaiting_return' ||
    booking.status === 'completed';
  const accepted = pickup?.yourDecision === 'accept' || started;
  const handed = !!booking.return_handed_back_at;
  const resolution = booking.return_resolution;
  const openReview = resolution === 'disputed' || resolution === 'review' || resolution === 'pending';
  const rows = [
    { done: true, title: t('rentalInspection.timelineBooked', 'Booked') },
    {
      done: pickup?.status === 'submitted' || accepted,
      title: t('rentalInspection.timelinePickupSubmitted', 'Condition report sent'),
    },
    {
      done: accepted,
      title: role === 'client'
        ? t('rentalInspection.timelineAccepted', 'You accepted the condition')
        : t('rentalInspection.statusClientAck', 'The renter accepted the condition report'),
    },
    {
      done: !!booking.actual_start_at || booking.status === 'active' || booking.status === 'awaiting_return' || booking.status === 'completed',
      title: t('rentalInspection.timelineStarted', 'Rental started'),
    },
    {
      done: handed,
      title: t('rentalInspection.timelineHandback', 'Physical handback recorded'),
    },
    {
      done: resolution === 'accepted' || resolution === 'admin_cleared',
      warn: resolution === 'disputed' || resolution === 'review' || returnView?.units.some((unit) => unit.condition === 'damaged'),
      title: t('rentalInspection.timelineReturnDamage', 'Return inspection'),
    },
    {
      done: booking.status === 'completed',
      title: t('rentalInspection.timelineSettlement', 'Settlement'),
      detail: openReview
        ? t('rentalInspection.timelineSettlementWaiting', 'Blocked while review is open')
        : role === 'business' && returnView?.units.some((unit) => unit.condition === 'damaged')
          ? damageRail(booking) === 'card'
            ? t('rentalInspection.railCard', 'The card hold stays open until the client agrees, which captures the agreed amount, or until support decides.')
            : t('rentalInspection.railRecorded', 'MoMo / wallet: the damage claim is record-only. Rent and overtime can settle. Rendasua support resolves any damage payment. Nothing is debited automatically.')
          : undefined,
    },
  ];
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
      }}
    >
      <Text style={[typography.caption, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
        {t('rentalInspection.timelineTitle', 'TIMELINE')}
      </Text>
      {rows.map((row) => (
        <View key={row.title} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ color: row.warn ? colors.warning.dark : row.done ? colors.cta.main : colors.text.disabled }}>
            {row.done ? '●' : '○'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body2, { color: colors.text.primary }]}>{row.title}</Text>
            {row.detail ? (
              <Text style={[typography.caption, { color: colors.text.secondary }]}>{row.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
