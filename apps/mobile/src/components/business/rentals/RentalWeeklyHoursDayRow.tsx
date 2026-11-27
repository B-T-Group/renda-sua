import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { RentalWeeklyAvailabilityRow } from '@/types/rentals';
import { weeklyTimeInputToStorage, weeklyTimeStorageToInput } from '@/utils/weeklyTimeInput';
import { RentalWeeklyHoursTimeField } from './RentalWeeklyHoursTimeField';

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const WEEKDAY_DEFAULTS: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

type Field = 'start' | 'end';
type Drafts = Partial<Record<Field, string>>;

const FIELD_PATCH_KEY = { start: 'start_time', end: 'end_time' } as const;
const FIELD_FALLBACK = { start: '08:00:00', end: '20:00:00' } as const;

export interface RentalWeeklyHoursDayRowProps {
  row: RentalWeeklyAvailabilityRow;
  onChange: (weekday: number, patch: Partial<RentalWeeklyAvailabilityRow>) => void;
}

/** One weekday: open/closed switch plus start and end time fields when open. */
export function RentalWeeklyHoursDayRow({ row, onChange }: RentalWeeklyHoursDayRowProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [drafts, setDrafts] = useState<Drafts>({});
  const key = WEEKDAY_KEYS[row.weekday] ?? 'monday';

  const stored = (field: Field) => row[FIELD_PATCH_KEY[field]];
  const shown = (field: Field) => drafts[field] ?? weeklyTimeStorageToInput(stored(field));

  const handleChange = useCallback(
    (field: Field, text: string) => {
      setDrafts((prev) => ({ ...prev, [field]: text }));
      const value = weeklyTimeInputToStorage(text);
      if (value) onChange(row.weekday, { [FIELD_PATCH_KEY[field]]: value });
    },
    [onChange, row.weekday]
  );

  const handleBlur = (field: Field) => {
    const text = drafts[field];
    setDrafts((prev) => ({ ...prev, [field]: undefined }));
    if (text?.trim() && !weeklyTimeInputToStorage(text)) {
      onChange(row.weekday, {
        [FIELD_PATCH_KEY[field]]: stored(field) ?? FIELD_FALLBACK[field],
      });
    }
  };

  const toggle = (is_available: boolean) =>
    onChange(row.weekday, {
      is_available,
      start_time: is_available ? row.start_time ?? FIELD_FALLBACK.start : null,
      end_time: is_available ? row.end_time ?? FIELD_FALLBACK.end : null,
    });

  return (
    <View style={[styles.row, { borderTopColor: colors.divider }]}>
      <View style={styles.header}>
        <View style={styles.dayText}>
          <Text variant="titleSmall" style={{ color: colors.text.primary }}>
            {t(`common.weekdays.${key}`, WEEKDAY_DEFAULTS[key])}
          </Text>
          {!row.is_available ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('common.closed', 'Closed')}
            </Text>
          ) : null}
        </View>
        <Switch
          testID={`weekly-hours-switch-${row.weekday}`}
          value={row.is_available}
          color={colors.primary.main}
          onValueChange={toggle}
        />
      </View>
      {row.is_available ? (
        <View style={[styles.times, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.md }]}>
          {(['start', 'end'] as const).map((field, index) => (
            <React.Fragment key={field}>
              {index === 1 ? (
                <Text style={[styles.dash, { color: colors.text.secondary }]}>–</Text>
              ) : null}
              <RentalWeeklyHoursTimeField
                testID={`weekly-hours-${field}-${row.weekday}`}
                label={
                  field === 'start'
                    ? t('business.rentals.wizard.location.weeklyHoursStart', 'Start')
                    : t('business.rentals.wizard.location.weeklyHoursEnd', 'End')
                }
                value={shown(field)}
                placeholder={weeklyTimeStorageToInput(FIELD_FALLBACK[field])}
                onChangeText={(text) => handleChange(field, text)}
                onBlur={() => handleBlur(field)}
              />
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayText: { flex: 1, minWidth: 0 },
  times: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 10 },
  dash: { fontSize: 18, paddingBottom: 10 },
});
