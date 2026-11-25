import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import type { BusinessRentalItemActivityStats } from '../../../types/rentals';
import { formatRentalMoney } from '../../../utils/rentals';

export function RentalItemActivityStatsStrip({
  stats,
}: {
  stats: BusinessRentalItemActivityStats;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const currency = stats.currency || 'XAF';
  const cells = [
    {
      key: 'earned',
      label: t('business.rentals.activity.earned', 'Earned'),
      value: formatRentalMoney(stats.earnedTotal, currency),
    },
    {
      key: 'times',
      label: t('business.rentals.activity.timesRented', 'Times rented'),
      value: String(stats.timesRented),
    },
    {
      key: 'out',
      label: t('business.rentals.activity.currentlyOut', 'Out now'),
      value: String(stats.currentlyOut),
    },
    {
      key: 'upcoming',
      label: t('business.rentals.activity.upcoming', 'Upcoming'),
      value: String(stats.upcoming),
    },
  ];
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          padding: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      {cells.map((cell) => (
        <View key={cell.key} style={styles.cell}>
          <Text variant="labelSmall" style={{ color: colors.text.secondary }} numberOfLines={1}>
            {cell.label}
          </Text>
          <Text variant="titleSmall" style={{ color: colors.text.primary }} numberOfLines={1}>
            {cell.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
  },
  cell: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 0,
    gap: 2,
  },
});
