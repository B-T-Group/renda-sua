import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './AppButton';
import { useTheme } from '@/contexts/ThemeContext';

export interface CheckoutStickyActionBarProps {
  label: string;
  total?: string;
  totalLabel?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Short description of why the button is disabled (shown below) */
  disabledReason?: string;
}

/**
 * Sticky bottom CTA bar for checkout screens (PlaceOrderScreen, CartCheckoutScreen).
 * Handles safe area insets, shadow, total summary, loading and disabled states.
 */
export function CheckoutStickyActionBar({
  label,
  total,
  totalLabel = 'Total',
  onPress,
  loading,
  disabled,
  disabledReason,
}: CheckoutStickyActionBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        shadows.large,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.card,
          borderTopRightRadius: borderRadius.card,
          paddingTop: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      {total ? (
        <View style={[styles.totalRow, { marginBottom: spacing.xs }]}>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>{totalLabel}</Text>
          <Text
            style={[
              typography.subheading,
              { color: colors.text.primary, fontWeight: '700' },
            ]}
          >
            {total}
          </Text>
        </View>
      ) : null}
      <PrimaryButton
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        fullWidth
      />
      {disabled && disabledReason ? (
        <Text
          style={[
            typography.caption,
            {
              color: colors.text.secondary,
              textAlign: 'center',
              marginTop: spacing.xxs,
            },
          ]}
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
