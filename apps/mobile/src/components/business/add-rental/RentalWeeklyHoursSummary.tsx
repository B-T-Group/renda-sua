import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { defaultWeeklyAvailability } from '../../../utils/rentals';
import type { RentalWeeklyAvailabilityRow } from '../../../types/rentals';

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function weekdayLabel(weekday: number, t: (k: string, d: string) => string): string {
  const key = WEEKDAY_KEYS[weekday] ?? 'monday';
  const defaults: Record<(typeof WEEKDAY_KEYS)[number], string> = {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  };
  return t(`common.weekdays.${key}`, defaults[key]);
}

export interface RentalWeeklyHoursSummaryProps {
  rows?: RentalWeeklyAvailabilityRow[];
}

export function RentalWeeklyHoursSummary({
  rows,
}: RentalWeeklyHoursSummaryProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const weekly = useMemo(() => rows ?? defaultWeeklyAvailability(), [rows]);
  const sorted = useMemo(
    () => [...weekly].sort((a, b) => a.weekday - b.weekday),
    [weekly]
  );

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginTop: spacing.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('business.rentals.wizard.location.weeklyHours', 'Weekly hours')}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: 4, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.wizard.location.weeklyHoursDefaultHint',
          'Default hours — customize per listing in the listing editor after publishing.'
        )}
      </Text>
      {sorted.map((row) => (
        <View key={row.weekday} style={styles.row}>
          <Text variant="bodySmall" style={{ color: colors.text.primary, flex: 1 }}>
            {weekdayLabel(row.weekday, t)}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {row.is_available && row.start_time && row.end_time
              ? `${row.start_time.slice(0, 5)} – ${row.end_time.slice(0, 5)}`
              : t('common.closed', 'Closed')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
