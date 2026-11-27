import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { defaultWeeklyAvailability } from '@/utils/rentals';
import {
  applyHoursToOpenDays,
  firstOpenDay,
  formatDayHours,
} from '@/utils/rentals/weeklyHours';
import type { RentalWeeklyAvailabilityRow } from '@/types/rentals';
import { RentalWeeklyHoursDayRow } from './RentalWeeklyHoursDayRow';

export interface RentalWeeklyHoursEditorProps {
  value: RentalWeeklyAvailabilityRow[];
  onChange: (rows: RentalWeeklyAvailabilityRow[]) => void;
}

/** Editable weekly availability for rental listings. */
export function RentalWeeklyHoursEditor({ value, onChange }: RentalWeeklyHoursEditorProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  const rows = useMemo(() => {
    const base = value.length ? value : defaultWeeklyAvailability();
    return [...base].sort((a, b) => a.weekday - b.weekday);
  }, [value]);

  const updateRow = useCallback(
    (weekday: number, patch: Partial<RentalWeeklyAvailabilityRow>) => {
      onChange(rows.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
    },
    [onChange, rows]
  );

  const source = firstOpenDay(rows);
  const canCopy = !!source && rows.filter((row) => row.is_available).length > 1;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('business.rentals.wizard.location.weeklyHours', 'Weekly hours')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
        {t(
          'business.rentals.wizard.location.weeklyHoursEditorHint',
          'Set when customers can pick up and return this item.'
        )}
      </Text>
      {canCopy && source ? (
        <Button
          compact
          icon="content-copy"
          mode="text"
          style={styles.copyButton}
          onPress={() => onChange(applyHoursToOpenDays(rows, source))}
          testID="weekly-hours-copy-all"
        >
          {t('business.rentals.wizard.location.weeklyHoursCopyAll', 'Use {{hours}} for all open days', {
            hours: formatDayHours(source),
          })}
        </Button>
      ) : null}
      {rows.map((row) => (
        <RentalWeeklyHoursDayRow key={row.weekday} row={row} onChange={updateRow} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  copyButton: { alignSelf: 'flex-start', marginTop: 4 },
});