import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { RentalPhaseStatusPill } from '../../../common/RentalPhaseStatusPill';
import { useTheme } from '../../../../contexts/ThemeContext';
import type { BusinessRentalScheduleRow } from '../../../../types/rentals';
import {
  formatRentalMoney,
  rentalPhaseColors,
  resolveBookingPhase,
} from '../../../../utils/rentals';
import {
  formatScheduleDateLine,
  formatScheduleTimeLine,
  scheduleClientName,
  scheduleDurationParts,
  type DurationParts,
} from '../../../../utils/rentals/businessSchedule';

export interface BusinessRentalScheduleCardProps {
  row: BusinessRentalScheduleRow;
  showItemName?: boolean;
  onPress: (bookingId: string) => void;
}

type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

function durationLabel(parts: DurationParts, t: Translate): string {
  const out: string[] = [];
  if (parts.days) out.push(t('business.rentals.schedule.duration.days', '{{count}} d', { count: parts.days }));
  if (parts.hours) out.push(t('business.rentals.schedule.duration.hours', '{{count}} h', { count: parts.hours }));
  if (parts.minutes && !parts.days) {
    out.push(t('business.rentals.schedule.duration.minutes', '{{count}} min', { count: parts.minutes }));
  }
  return out.join(' ');
}

function DetailLine({ icon, children }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.line}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.text.secondary} />
      {children}
    </View>
  );
}

function BusinessRentalScheduleCardInner({ row, showItemName, onPress }: BusinessRentalScheduleCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const name = scheduleClientName(row) || t('business.rentals.schedule.client', 'Client');
  const itemName = row.rental_location_listing?.rental_item?.name;
  const accent = rentalPhaseColors(resolveBookingPhase(row.status, 'business').phase, colors).textColor;
  const duration = durationLabel(scheduleDurationParts(row.start_at, row.end_at), t as Translate);
  const dateLine = formatScheduleDateLine(row.start_at, row.end_at, i18n.language);
  const timeLine = formatScheduleTimeLine(row.start_at, row.end_at, i18n.language);
  const price = formatRentalMoney(Number(row.total_amount), row.currency);
  const muted = { color: colors.text.secondary };

  return (
    <View
      style={[
        shadows.sm,
        { borderRadius: borderRadius.card, backgroundColor: colors.surface, marginBottom: spacing.sm },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('business.rentals.schedule.openBookingA11y', 'Open booking for {{name}}, {{date}}, {{time}}', { name, date: dateLine, time: timeLine })}
        onPress={() => onPress(row.id)}
        style={({ pressed }) => [
          styles.card,
          { borderColor: colors.divider, borderRadius: borderRadius.card, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={[styles.body, { padding: spacing.md, gap: spacing.xs }]}>
          <View style={styles.header}>
            <Text numberOfLines={1} style={[typography.subtitle1, styles.name, { color: colors.text.primary }]}>
              {name}
            </Text>
            <RentalPhaseStatusPill bookingStatus={row.status} role="business" />
          </View>
          {showItemName && itemName ? (
            <DetailLine icon="cube-outline">
              <Text numberOfLines={1} style={[typography.body2, styles.lineText, { color: colors.text.primary }]}>
                {itemName}
              </Text>
            </DetailLine>
          ) : null}
          <DetailLine icon="calendar-blank-outline">
            <Text numberOfLines={1} style={[typography.body2, styles.lineText, { color: colors.text.primary }]}>
              {dateLine}
            </Text>
          </DetailLine>
          <DetailLine icon="clock-outline">
            <Text numberOfLines={1} style={[typography.body2, styles.lineText, muted]}>
              {duration ? `${timeLine} · ${duration}` : timeLine}
            </Text>
          </DetailLine>
          <View style={[styles.footer, { marginTop: spacing.xxs }]}>
            <Text style={[typography.h6, { color: colors.primary.main }]}>{price}</Text>
            <View style={styles.cta}>
              <Text style={[typography.caption, muted]}>{t('business.rentals.schedule.viewDetails', 'View details')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.secondary} />
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export const BusinessRentalScheduleCard = memo(BusinessRentalScheduleCardInner);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden', minHeight: 44 },
  accent: { width: 5 },
  body: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 0, fontWeight: '600' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1, minWidth: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { flexDirection: 'row', alignItems: 'center' },
});
