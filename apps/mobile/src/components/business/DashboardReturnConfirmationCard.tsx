import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessReturnConfirmationRow } from '../../types/rentals';
import { buildReturnCardModel } from '../../utils/rentals/dashboardReturnConfirmations';
import { RentalItemThumb } from './RentalItemThumb';

export function DashboardReturnConfirmationCard({
  row,
  width,
  busy,
  onOpen,
  onConfirm,
  onProblem,
}: {
  row: BusinessReturnConfirmationRow;
  width?: number;
  busy: boolean;
  onOpen: (row: BusinessReturnConfirmationRow) => void;
  onConfirm: (row: BusinessReturnConfirmationRow) => void;
  onProblem: (row: BusinessReturnConfirmationRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const model = buildReturnCardModel(row, i18n.language);
  return (
    <View
      testID="dashboard-return-card"
      style={[
        styles.card,
        { width, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: borderRadius.card },
      ]}
    >
      <Pressable
        testID="dashboard-return-open"
        accessibilityRole="button"
        accessibilityLabel={t('business.dashboard.rentalReturns.openBooking', 'Open booking')}
        onPress={() => onOpen(row)}
        style={styles.row}
      >
        <RentalItemThumb item={row.rental_location_listing.rental_item} />
        <View style={styles.body}>
          <Text variant="labelSmall" style={{ color: colors.warning.dark, fontWeight: '700' }}>
            {t('business.dashboard.rentalReturns.chip', 'Return to confirm')}
          </Text>
          <Text variant="titleSmall" numberOfLines={2}>{model.itemName}</Text>
          {model.renterName ? (
            <Text variant="bodySmall" numberOfLines={1}>
              {t('business.dashboard.rentalReturns.renter', 'Renter: {{name}}', { name: model.renterName })}
            </Text>
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.text.secondary }} numberOfLines={2}>
            {t('business.dashboard.rentalReturns.reported', 'Renter reported the return · {{time}}', {
              time: model.reportedStamp,
            })}
          </Text>
        </View>
      </Pressable>
      <View style={[styles.actions, { gap: spacing.sm }]}>
        <Button
          mode="outlined"
          textColor={colors.error.main}
          disabled={busy}
          style={styles.action}
          onPress={() => onProblem(row)}
          testID="dashboard-return-problem"
        >
          {t('business.dashboard.rentalReturns.reportProblem', 'Report a problem')}
        </Button>
        <Button
          mode="contained"
          buttonColor={colors.success.main}
          loading={busy}
          disabled={busy}
          style={styles.action}
          onPress={() => onConfirm(row)}
          testID="dashboard-return-confirm"
        >
          {t('business.dashboard.rentalReturns.confirm', 'Confirm return')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  action: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
});
