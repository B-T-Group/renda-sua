import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { defaultWeeklyAvailability } from '@/utils/rentals';
import type { RentalWeeklyAvailabilityRow } from '@/types/rentals';
import {
  weeklyTimeInputToStorage,
  weeklyTimeStorageToInput,
} from '@/utils/weeklyTimeInput';

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

type TimeDraft = { start: string; end: string };

export interface RentalWeeklyHoursEditorProps {
  value: RentalWeeklyAvailabilityRow[];
  onChange: (rows: RentalWeeklyAvailabilityRow[]) => void;
}

/** Editable weekly availability for rental listings. */
export function RentalWeeklyHoursEditor({ value, onChange }: RentalWeeklyHoursEditorProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [timeDrafts, setTimeDrafts] = useState<Record<number, Partial<TimeDraft>>>({});

  const rows = useMemo(() => {
    const base = value.length ? value : defaultWeeklyAvailability();
    return [...base].sort((a, b) => a.weekday - b.weekday);
  }, [value]);

  const updateRow = useCallback(
    (weekday: number, patch: Partial<RentalWeeklyAvailabilityRow>) => {
      onChange(
        rows.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row))
      );
    },
    [onChange, rows]
  );

  const displayTime = useCallback(
    (weekday: number, field: 'start' | 'end', stored: string | null | undefined) => {
      const draft = timeDrafts[weekday]?.[field];
      if (draft != null) return draft;
      return weeklyTimeStorageToInput(stored);
    },
    [timeDrafts]
  );

  const handleTimeChange = useCallback(
    (weekday: number, field: 'start' | 'end', text: string) => {
      setTimeDrafts((prev) => ({
        ...prev,
        [weekday]: { ...prev[weekday], [field]: text },
      }));
      const stored = weeklyTimeInputToStorage(text);
      if (stored) {
        updateRow(weekday, field === 'start' ? { start_time: stored } : { end_time: stored });
      }
    },
    [updateRow]
  );

  const handleTimeBlur = useCallback(
    (
      weekday: number,
      field: 'start' | 'end',
      stored: string | null | undefined,
      draftText: string
    ) => {
      setTimeDrafts((prev) => {
        const next = { ...prev };
        const rowDraft = { ...next[weekday] };
        delete rowDraft[field];
        if (Object.keys(rowDraft).length === 0) {
          delete next[weekday];
        } else {
          next[weekday] = rowDraft;
        }
        return next;
      });
      if (draftText.trim() && !weeklyTimeInputToStorage(draftText)) {
        updateRow(
          weekday,
          field === 'start'
            ? { start_time: stored ?? '08:00:00' }
            : { end_time: stored ?? '20:00:00' }
        );
      }
    },
    [updateRow]
  );

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
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: 4, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.weeklyHoursEditorHint',
          'Set when customers can pick up and return this item.'
        )}
      </Text>
      {rows.map((row) => (
        <View key={row.weekday} style={[styles.row, { borderTopColor: colors.divider }]}>
          <Text variant="bodySmall" style={{ color: colors.text.primary, flex: 1 }}>
            {weekdayLabel(row.weekday, t)}
          </Text>
          <Switch
            value={row.is_available}
            onValueChange={(is_available) =>
              updateRow(row.weekday, {
                is_available,
                start_time: is_available ? row.start_time ?? '08:00:00' : null,
                end_time: is_available ? row.end_time ?? '20:00:00' : null,
              })
            }
          />
          {row.is_available ? (
            <View style={styles.timeRow}>
              <TextInput
                mode="outlined"
                dense
                label={t('business.rentals.weeklyHoursStart', 'Start')}
                value={displayTime(row.weekday, 'start', row.start_time)}
                onChangeText={(text) => handleTimeChange(row.weekday, 'start', text)}
                onBlur={() =>
                  handleTimeBlur(
                    row.weekday,
                    'start',
                    row.start_time,
                    displayTime(row.weekday, 'start', row.start_time)
                  )
                }
                style={styles.timeInput}
                keyboardType="numbers-and-punctuation"
                placeholder="08:00"
              />
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                –
              </Text>
              <TextInput
                mode="outlined"
                dense
                label={t('business.rentals.weeklyHoursEnd', 'End')}
                value={displayTime(row.weekday, 'end', row.end_time)}
                onChangeText={(text) => handleTimeChange(row.weekday, 'end', text)}
                onBlur={() =>
                  handleTimeBlur(
                    row.weekday,
                    'end',
                    row.end_time,
                    displayTime(row.weekday, 'end', row.end_time)
                  )
                }
                style={styles.timeInput}
                keyboardType="numbers-and-punctuation"
                placeholder="20:00"
              />
            </View>
          ) : (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, minWidth: 72 }}>
              {t('common.closed', 'Closed')}
            </Text>
          )}
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 4,
    paddingLeft: 8,
  },
  timeInput: {
    flex: 1,
    minWidth: 96,
  },
});
