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
  /** True when deposit equals floor amount (151 XAF). */
  isFloorAmount?: boolean;
  /** Grand total for calculating percentage (optional). */
  grandTotal?: number;
}

/**
 * Reservation deposit explainer card.
 * Shows why a deposit is required and what it covers.
 */
export function ReservationDepositExplainer({
  depositAmount,
  currency,
  style,
  isFloorAmount,
  grandTotal,
}: ReservationDepositExplainerProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();

  // Calculate percentage used for non-floor amounts
  const percentageUsed = grandTotal && !isFloorAmount && grandTotal > 0
    ? (grandTotal < 5000 ? 10 : 5)
    : null;

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

      {isFloorAmount ? (
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
          {t('deposit.minimumLabel', 'Minimum deposit for this order')}
        </Text>
      ) : percentageUsed ? (
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
          {t('deposit.percentageLabel', '{{percentage}}% of your order', { percentage: percentageUsed })}
        </Text>
      ) : null}

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
