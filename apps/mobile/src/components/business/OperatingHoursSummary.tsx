import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  dayDisplayLabel,
  operatingHoursToEditorRows,
  type OperatingHours,
} from '../../utils/operatingHours';

export interface OperatingHoursSummaryProps {
  operatingHours?: OperatingHours | null;
}

export function OperatingHoursSummary({ operatingHours }: OperatingHoursSummaryProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const rows = useMemo(
    () => operatingHoursToEditorRows(operatingHours),
    [operatingHours]
  );

  return (
    <View style={{ gap: spacing.xxs }}>
      {rows.map((row) => (
        <View key={row.day} style={styles.row}>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.primary, flex: 1, minWidth: 0 }}
            numberOfLines={1}
          >
            {dayDisplayLabel(row.day, t)}
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: row.enabled ? colors.text.secondary : colors.text.disabled,
            }}
            numberOfLines={1}
          >
            {row.enabled
              ? `${row.open} – ${row.close}`
              : t('common.closed', 'Closed')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
});
