import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { BusinessReferralCommissionVector } from '../illustrations/BusinessReferralCommissionVector';
import { formatCurrency } from '../../utils/formatters';

type Props = {
  availableBalance: number;
  balanceCurrency: string;
  projectedAmount: number;
  projectedCurrency: string;
  onOpenWallet: () => void;
};

export function ReferralPayoutSnapshot({
  availableBalance,
  balanceCurrency,
  projectedAmount,
  projectedCurrency,
  onOpenWallet,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  if (projectedAmount <= 0) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.md,
          padding: spacing.md,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={t(
        'referrals.projectedPayout.title',
        'Saturday payout'
      )}
    >
      <View style={styles.top}>
        <BusinessReferralCommissionVector size={72} />
        <View style={[styles.copy, { minWidth: 0, flex: 1 }]}>
          <Text
            variant="titleSmall"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t('referrals.projectedPayout.title', 'Saturday payout')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'referrals.projectedPayout.hint',
              'Approved referrals awaiting this week’s payout.'
            )}
          </Text>
        </View>
      </View>
      <View style={[styles.amounts, { gap: spacing.md }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="labelSmall" style={{ color: colors.text.disabled }}>
            {t('referrals.projectedPayout.available', 'Available')}
          </Text>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {formatCurrency(availableBalance, balanceCurrency)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="labelSmall" style={{ color: colors.success.main }}>
            {t('referrals.projectedPayout.expected', 'Expected this Saturday')}
          </Text>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{ color: colors.success.main, fontWeight: '700' }}
          >
            {formatCurrency(projectedAmount, projectedCurrency)}
          </Text>
        </View>
      </View>
      <Button
        mode="contained"
        onPress={onOpenWallet}
        style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
      >
        {t('referrals.projectedPayout.wallet', 'Wallet')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { gap: 4 },
  amounts: { flexDirection: 'row', marginTop: 12 },
});
