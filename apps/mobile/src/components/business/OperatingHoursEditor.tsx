import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  applyHoursToEnabledDays,
  dayDisplayLabelShort,
  isValidOpenCloseWindow,
  type DayName,
  type OperatingHoursEditorRow,
} from '../../utils/operatingHours';
import { OperatingHoursTimeSheet } from './OperatingHoursTimeSheet';

type TimeField = 'open' | 'close';
type PickerTarget = { day: DayName; field: TimeField } | null;

export interface OperatingHoursEditorProps {
  value: OperatingHoursEditorRow[];
  onChange: (rows: OperatingHoursEditorRow[]) => void;
  title?: string;
  hint?: string;
  disabled?: boolean;
  /** Label when a day is off. Location hours use “Closed”. */
  offDayLabel?: string;
}

function TimeChip({
  value,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.timeChip,
        {
          borderColor: colors.divider,
          backgroundColor: colors.pageBackground,
          borderRadius: borderRadius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 2,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {value}
      </Text>
    </Pressable>
  );
}

function DayRow({
  row,
  disabled,
  offDayLabel,
  onToggle,
  onOpenPicker,
}: {
  row: OperatingHoursEditorRow;
  disabled?: boolean;
  offDayLabel: string;
  onToggle: (enabled: boolean) => void;
  onOpenPicker: (field: TimeField) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const invalid =
    row.enabled && !isValidOpenCloseWindow(row.open, row.close);

  return (
    <View
      style={[
        styles.row,
        {
          borderTopColor: colors.divider,
          opacity: row.enabled ? 1 : 0.72,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.primary, fontWeight: '600', width: 40 }}
          numberOfLines={1}
        >
          {dayDisplayLabelShort(row.day, t)}
        </Text>
        <Switch
          value={row.enabled}
          onValueChange={onToggle}
          disabled={disabled}
          accessibilityLabel={t('business.locations.operatingHours.openDay', 'Open {{day}}', {
            day: dayDisplayLabelShort(row.day, t),
          })}
        />
        {row.enabled ? (
          <View style={styles.times}>
            <TimeChip
              value={row.open}
              disabled={disabled}
              onPress={() => onOpenPicker('open')}
              accessibilityLabel={t('business.locations.operatingHours.open', 'Open')}
            />
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              –
            </Text>
            <TimeChip
              value={row.close}
              disabled={disabled}
              onPress={() => onOpenPicker('close')}
              accessibilityLabel={t('business.locations.operatingHours.close', 'Close')}
            />
          </View>
        ) : (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, flex: 1, textAlign: 'right' }}
          >
            {offDayLabel}
          </Text>
        )}
      </View>
      {invalid ? (
        <Text variant="labelSmall" style={{ color: colors.error.main, marginTop: 4 }}>
          {t(
            'business.locations.operatingHours.invalidWindow',
            'Close time must be after open time.'
          )}
        </Text>
      ) : null}
    </View>
  );
}

export function OperatingHoursEditor({
  value,
  onChange,
  title,
  hint,
  disabled = false,
  offDayLabel,
}: OperatingHoursEditorProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [lastEditedDay, setLastEditedDay] = useState<DayName | null>(null);

  const sourceRow = useMemo(() => {
    if (lastEditedDay) {
      const edited = value.find((row) => row.day === lastEditedDay && row.enabled);
      if (edited) return edited;
    }
    return value.find((row) => row.enabled) ?? null;
  }, [lastEditedDay, value]);
  const openCount = useMemo(() => value.filter((row) => row.enabled).length, [value]);
  const canApplyToAll = !!sourceRow && openCount > 1;

  const updateRow = useCallback(
    (day: DayName, patch: Partial<OperatingHoursEditorRow>) => {
      onChange(value.map((row) => (row.day === day ? { ...row, ...patch } : row)));
    },
    [onChange, value]
  );

  const handleToggle = useCallback(
    (day: DayName, enabled: boolean, row: OperatingHoursEditorRow) => {
      if (disabled) return;
      if (enabled) setLastEditedDay(day);
      updateRow(day, {
        enabled,
        open: enabled ? row.open || '08:00' : row.open,
        close: enabled ? row.close || '20:00' : row.close,
      });
    },
    [disabled, updateRow]
  );

  const handleConfirmTime = useCallback(
    (hhMm: string) => {
      if (!picker) return;
      setLastEditedDay(picker.day);
      updateRow(picker.day, picker.field === 'open' ? { open: hhMm } : { close: hhMm });
      setPicker(null);
    },
    [picker, updateRow]
  );

  const applyToAll = useCallback(() => {
    if (!sourceRow) return;
    onChange(applyHoursToEnabledDays(value, sourceRow.day));
  }, [onChange, sourceRow, value]);

  const pickerTitle =
    picker == null
      ? ''
      : picker.field === 'open'
        ? t('business.locations.operatingHours.pickOpen', 'Open time · {{day}}', {
            day: dayDisplayLabelShort(picker.day, t),
          })
        : t('business.locations.operatingHours.pickClose', 'Close time · {{day}}', {
            day: dayDisplayLabelShort(picker.day, t),
          });

  const pickerValue =
    picker == null
      ? '08:00'
      : value.find((row) => row.day === picker.day)?.[picker.field] ?? '08:00';

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
        {title ?? t('business.locations.operatingHours.title', 'Operating hours')}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: 4, marginBottom: spacing.sm }}
      >
        {hint ??
          t(
            'business.locations.operatingHours.hint',
            'Clients can only book delivery or pickup slots that fall fully within these hours.'
          )}
      </Text>

      {canApplyToAll && !disabled ? (
        <Button
          mode="outlined"
          compact
          icon="content-copy"
          onPress={applyToAll}
          style={{ marginBottom: spacing.sm, alignSelf: 'flex-start' }}
        >
          {t(
            'business.locations.operatingHours.applyToAllOpen',
            'Apply {{hours}} to all open days',
            { hours: `${sourceRow!.open}–${sourceRow!.close}` }
          )}
        </Button>
      ) : null}

      {value.map((row) => (
        <DayRow
          key={row.day}
          row={row}
          disabled={disabled}
          offDayLabel={offDayLabel ?? t('common.closed', 'Closed')}
          onToggle={(enabled) => handleToggle(row.day, enabled, row)}
          onOpenPicker={(field) => setPicker({ day: row.day, field })}
        />
      ))}

      <OperatingHoursTimeSheet
        visible={picker != null}
        title={pickerTitle}
        value={pickerValue}
        onDismiss={() => setPicker(null)}
        onConfirm={handleConfirmTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  times: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minWidth: 0,
  },
  timeChip: {
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 64,
    alignItems: 'center',
  },
});
