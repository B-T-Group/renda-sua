import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';

export interface ReservationDepositExplainerProps {
  depositAmount: number;
  currency: string;
  style?: object;
  /** True when the server raised the sum to the 150 XAF minimum. */
  minimumApplied?: boolean;
  /** Shared merchant percent. Null when lines use different percents. */
  percent?: number | null;
}

/**
 * Reservation deposit explainer card.
 * Shows why a deposit is required and what it covers.
 */
export function ReservationDepositExplainer({
  depositAmount,
  currency,
  style,
  minimumApplied = false,
  percent = null,
}: ReservationDepositExplainerProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="hand-coin-outline" size={24} color={colors.primary.main} />
        <Text
          variant="titleSmall"
          style={[
            typography.subtitle2,
            { color: colors.text.primary, marginLeft: spacing.sm, flex: 1 },
          ]}
        >
          {t('deposit.reservationTitle', 'Reservation deposit')}
        </Text>
      </View>

      <Text
        variant="headlineSmall"
        style={[
          typography.h6,
          {
            color: colors.primary.main,
            marginTop: spacing.xs,
            fontWeight: '700',
          },
        ]}
      >
        {formatCatalogMoney(depositAmount, currency)}
      </Text>

      <Text
        variant="bodySmall"
        style={[
          typography.caption,
          {
            color: colors.text.secondary,
            marginTop: spacing.xs,
          },
        ]}
      >
        {depositDetail(t, minimumApplied, percent)}
      </Text>

      <View style={[styles.bulletList, { marginTop: spacing.sm }]}>
        <View style={styles.bulletRow}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={16}
            color={colors.primary.main}
            style={{ marginTop: 2 }}
          />
          <Text
            variant="bodySmall"
            style={[
              typography.body2,
              { color: colors.text.secondary, marginLeft: spacing.xs, flex: 1 },
            ]}
          >
            {t(
              'deposit.refundableUntilSent',
              'Refundable until we send it for delivery, or until it is ready for pickup'
            )}
          </Text>
        </View>

        <View style={[styles.bulletRow, { marginTop: spacing.xs }]}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={16}
            color={colors.primary.main}
            style={{ marginTop: 2 }}
          />
          <Text
            variant="bodySmall"
            style={[
              typography.body2,
              { color: colors.text.secondary, marginLeft: spacing.xs, flex: 1 },
            ]}
          >
            {t('deposit.appliedToTotal', 'Applied to your order — not an extra fee')}
          </Text>
        </View>
      </View>

    </View>
  );
}

function depositDetail(
  t: (key: string, defaultValue: string, options?: { percentage: number }) => string,
  minimumApplied: boolean,
  percent: number | null
): string {
  if (minimumApplied) {
    return t('deposit.minimumLabel', 'Minimum deposit for this order');
  }
  if (percent != null) {
    return t(
      'deposit.percentageLabel',
      '{{percentage}}% of items that require a deposit',
      { percentage: percent }
    );
  }
  return t(
    'deposit.mixedItemsLabel',
    'Deposit on items this store requires a deposit for'
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletList: {},
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
