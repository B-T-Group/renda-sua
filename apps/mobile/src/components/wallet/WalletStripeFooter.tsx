import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export interface WalletStripeFooterProps {
  stripeConnected: boolean;
  onPress: () => void;
}

export function WalletStripeFooter({ stripeConnected, onPress }: WalletStripeFooterProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();

  return (
    <View
      style={[
        styles.footer,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
        {t('accounts.stripePayoutsFooterTitle', 'Stripe payouts')}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t(
          'accounts.stripePayoutsFooterHint',
          'Payouts for all your wallets go to your connected Stripe account.'
        )}
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.btn,
          {
            borderColor: colors.primary.main,
            borderRadius: borderRadius.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          stripeConnected
            ? t('accounts.viewStripeAccount', 'View Stripe account')
            : t('accounts.setUpStripePayouts', 'Set up Stripe payouts')
        }
      >
        <MaterialCommunityIcons name="open-in-new" size={18} color={colors.primary.main} />
        <Text style={[typography.button, { color: colors.primary.main }]}>
          {stripeConnected
            ? t('accounts.viewStripeAccount', 'View Stripe account')
            : t('accounts.setUpStripePayouts', 'Set up Stripe payouts')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderWidth: 1 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
});
