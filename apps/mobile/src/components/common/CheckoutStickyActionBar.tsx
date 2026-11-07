import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from './AppButton';
import { useTheme } from '@/contexts/ThemeContext';

export interface CheckoutStickyBreakdownLine {
  label: string;
  value: string;
  /** secondary = muted, success = green, emphasize = bold primary total */
  tone?: 'default' | 'secondary' | 'success' | 'emphasize';
  /** Pre-waiver amount shown struck through beside the value. */
  strike?: string;
  /** Quiet caption under the label. */
  hint?: string;
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
  /** Chosen delivery or pickup time. Tapping scrolls back to the picker. */
  timeSummary?: string;
  onTimeSummaryPress?: () => void;
  /** True when a slot still has to be chosen. */
  timeSummaryAttention?: boolean;
  timeSummaryHint?: string;
  /** Makes the disabled-reason line jump to the section the shopper must fix. */
  onDisabledReasonPress?: () => void;
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
  timeSummary,
  onTimeSummaryPress,
  timeSummaryAttention,
  timeSummaryHint,
  onDisabledReasonPress,
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

      {timeSummary && onTimeSummaryPress ? (
        <TimeSummaryRow
          label={timeSummary}
          hint={timeSummaryHint}
          attention={timeSummaryAttention}
          onPress={onTimeSummaryPress}
        />
      ) : null}

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
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.text.secondary,
                        fontWeight: emphasize ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {line.label}
                  </Text>
                  {line.hint ? (
                    <Text
                      style={[typography.caption, { color: colors.text.secondary }]}
                      numberOfLines={2}
                    >
                      {line.hint}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.strikeRow}>
                  {line.strike ? (
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: colors.text.secondary,
                          textDecorationLine: 'line-through',
                          marginRight: 6,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {line.strike}
                    </Text>
                  ) : null}
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

      <CtaButton
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        fullWidth
      />
      {disabled && disabledReason ? (
        <DisabledReason
          reason={disabledReason}
          onPress={onDisabledReasonPress}
        />
      ) : null}
    </View>
  );
}

function TimeSummaryRow({
  label,
  hint,
  attention,
  onPress,
}: {
  label: string;
  hint?: string;
  attention?: boolean;
  onPress: () => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.summaryPress}
    >
      <Text
        style={[
          typography.caption,
          {
            color: attention ? colors.primary.main : colors.text.primary,
            fontWeight: '600',
            textAlign: 'center',
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DisabledReason({ reason, onPress }: { reason: string; onPress?: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const color = onPress ? colors.primary.main : colors.text.secondary;
  const text = (
    <Text
      style={[typography.caption, { color, textAlign: 'center', fontWeight: onPress ? '600' : '400' }]}
    >
      {reason}
    </Text>
  );
  if (!onPress) {
    return <View style={{ marginTop: -spacing.xxs }}>{text}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={reason}
      onPress={onPress}
      style={[styles.summaryPress, { marginTop: -spacing.xxs }]}
    >
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryPress: {
    minHeight: 44,
    justifyContent: 'center',
  },
  wrapper: {},
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
