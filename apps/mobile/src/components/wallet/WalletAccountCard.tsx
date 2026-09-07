import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { AccountInfoRow } from '../../types/accountWallet';
import { isLegacyWallet } from '../../utils/walletAccounts';

function formatWalletBalance(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface WalletAccountCardProps {
  account: AccountInfoRow;
  isStripeRail: boolean;
  stripeReady: boolean;
  onViewTransactions: (account: AccountInfoRow) => void;
  onWithdraw: (account: AccountInfoRow) => void;
  onTopUp: (account: AccountInfoRow) => void;
}

export function WalletAccountCard({
  account,
  isStripeRail,
  stripeReady,
  onViewTransactions,
  onWithdraw,
  onTopUp,
}: WalletAccountCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const title = isLegacyWallet(account)
    ? t('accounts.personalWalletLabel', 'Personal wallet')
    : (account.business_location?.name ??
      t('accounts.locationsSection', 'Business locations'));

  const withdrawDisabled =
    account.available_balance <= 0 || (isStripeRail && !stripeReady);

  const handleTx = useCallback(() => onViewTransactions(account), [onViewTransactions, account]);
  const handleWithdraw = useCallback(() => onWithdraw(account), [onWithdraw, account]);
  const handleTopUp = useCallback(() => onTopUp(account), [onTopUp, account]);

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text
          style={[
            typography.subtitle1,
            { color: colors.text.primary, fontWeight: '600', flex: 1, minWidth: 0 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <StatusPill
          label={account.currency}
          backgroundColor={colors.primaryTint}
          textColor={colors.primary.main}
          compact
        />
      </View>

      <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
        {t('accounts.availableBalance', 'Available balance')}
      </Text>
      <Text style={[typography.h5, { color: colors.primary.main, marginTop: 4 }]}>
        {formatWalletBalance(account.available_balance, account.currency)}
      </Text>

      {account.withheld_balance > 0 ? (
        <Text style={[typography.caption, { color: colors.warning.main, marginTop: 4 }]}>
          {t('accounts.onHold', 'On hold')}:{' '}
          {formatWalletBalance(account.withheld_balance, account.currency)}
        </Text>
      ) : null}

      <View style={[styles.actionsRow, { gap: spacing.xs, marginTop: spacing.md }]}>
        <Pressable
          onPress={handleTx}
          style={({ pressed }) => [
            styles.btnOutline,
            styles.btnGrow,
            {
              borderColor: colors.primary.main,
              borderRadius: borderRadius.sm,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('accounts.viewTransactions', 'Transactions')}
        >
          <MaterialCommunityIcons name="history" size={18} color={colors.primary.main} />
          <Text style={[typography.button, { color: colors.primary.main }]} numberOfLines={1}>
            {t('accounts.viewTransactions', 'Transactions')}
          </Text>
        </Pressable>
        {!isStripeRail ? (
          <Pressable
            onPress={handleTopUp}
            style={({ pressed }) => [
              styles.btnOutline,
              styles.btnGrow,
              {
                borderColor: colors.primary.main,
                borderRadius: borderRadius.sm,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.topUp', 'Top up')}
          >
            <MaterialCommunityIcons
              name="wallet-plus-outline"
              size={18}
              color={colors.primary.main}
            />
            <Text style={[typography.button, { color: colors.primary.main }]} numberOfLines={1}>
              {t('accounts.topUp', 'Top up')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={handleWithdraw}
        disabled={withdrawDisabled}
        style={({ pressed }) => [
          styles.btnFilled,
          {
            backgroundColor: colors.primary.main,
            borderRadius: borderRadius.sm,
            opacity: withdrawDisabled ? 0.45 : pressed ? 0.9 : 1,
            marginTop: spacing.sm,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('accounts.withdraw', 'Withdraw')}
        accessibilityState={{ disabled: withdrawDisabled }}
      >
        <MaterialCommunityIcons
          name="bank-transfer-out"
          size={18}
          color={colors.primary.contrast}
        />
        <Text style={[typography.button, { color: colors.primary.contrast }]}>
          {t('accounts.withdraw', 'Withdraw')}
        </Text>
      </Pressable>

      {isStripeRail && !stripeReady && account.available_balance > 0 ? (
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, marginTop: spacing.xs, textAlign: 'center' },
          ]}
        >
          {t(
            'accounts.stripePayoutSetupRequired',
            'Set up and activate Stripe payouts to withdraw.'
          )}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsRow: { flexDirection: 'row' },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  btnGrow: { minWidth: 0 },
  btnFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
