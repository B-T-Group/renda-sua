import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './AppButton';
import { useTheme } from '@/contexts/ThemeContext';

export interface CheckoutStickyBreakdownLine {
  label: string;
  value: string;
  /** secondary = muted, success = green, emphasize = bold primary total */
  tone?: 'default' | 'secondary' | 'success' | 'emphasize';
}

export interface CheckoutStickyActionBarProps {
  label: string;
  total?: string;
  totalLabel?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Short description of why the button is disabled (shown below) */
  disabledReason?: string;
  /** Compact fulfillment control (or other top content). */
  topContent?: ReactNode;
  /** Line items for subtotal / fees / discounts before the total. */
  breakdown?: CheckoutStickyBreakdownLine[];
}

/**
 * Sticky bottom CTA bar for checkout screens (PlaceOrderScreen, CartCheckoutScreen).
 * Handles safe area insets, fulfillment toggle, financial breakdown, and CTA.
 */
export function CheckoutStickyActionBar({
  label,
  total,
  totalLabel = 'Total',
  onPress,
  loading,
  disabled,
  disabledReason,
  topContent,
  breakdown,
}: CheckoutStickyActionBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const hasBreakdown = (breakdown?.length ?? 0) > 0;

  return (
    <View
      style={[
        styles.wrapper,
        shadows.large,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.card,
          borderTopRightRadius: borderRadius.card,
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
        },
      ]}
    >
      {topContent ? <View>{topContent}</View> : null}

      {hasBreakdown ? (
        <View style={{ gap: 4 }}>
          {breakdown!.map((line) => {
            const emphasize = line.tone === 'emphasize';
            const color =
              line.tone === 'success'
                ? colors.success.main
                : line.tone === 'secondary'
                  ? colors.text.secondary
                  : colors.text.primary;
            return (
              <View key={`${line.label}-${line.value}`} style={styles.breakdownRow}>
                <Text
                  style={[
                    emphasize ? typography.caption : typography.caption,
                    {
                      color: colors.text.secondary,
                      fontWeight: emphasize ? '700' : '500',
                      flex: 1,
                      paddingRight: spacing.sm,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {line.label}
                </Text>
                <Text
                  style={[
                    emphasize ? typography.subtitle2 : typography.caption,
                    { color, fontWeight: emphasize ? '800' : '600' },
                  ]}
                  numberOfLines={1}
                >
                  {line.value}
                </Text>
              </View>
            );
          })}
        </View>
      ) : total ? (
        <View style={styles.breakdownRow}>
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
              marginTop: -spacing.xxs,
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
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
