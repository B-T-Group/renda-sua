import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/theme';

export type TrustBadgeVariant =
  | 'verified_seller'
  | 'verified_user'
  | 'secure_checkout'
  | 'encrypted_payments'
  | 'fast_delivery'
  | 'top_rated'
  | 'response_time'
  | 'return_policy';

interface TrustConfig {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultLabel: string;
  color: string;
}

function buildTrustConfig(colors: ThemeColors): Record<TrustBadgeVariant, TrustConfig> {
  return {
    verified_seller: {
      icon: 'check-decagram',
      defaultLabel: 'Verified Seller',
      color: colors.primary.main,
    },
    verified_user: {
      icon: 'shield-check',
      defaultLabel: 'Verified User',
      color: colors.primary.main,
    },
    secure_checkout: {
      icon: 'lock',
      defaultLabel: 'Secure Checkout',
      color: colors.success.main,
    },
    encrypted_payments: {
      icon: 'shield-lock',
      defaultLabel: 'Encrypted Payments',
      color: colors.success.main,
    },
    fast_delivery: {
      icon: 'lightning-bolt',
      defaultLabel: 'Fast Delivery',
      color: colors.warning.dark,
    },
    top_rated: {
      icon: 'star',
      defaultLabel: 'Top Rated',
      color: colors.warning.main,
    },
    response_time: {
      icon: 'message-reply-text',
      defaultLabel: 'Quick Response',
      color: colors.info.main,
    },
    return_policy: {
      icon: 'arrow-u-left-top',
      defaultLabel: 'Easy Returns',
      color: colors.secondary.dark,
    },
  };
}

export interface TrustBadgeProps {
  variant: TrustBadgeVariant;
  /** Override the default label */
  label?: string;
  /** Supplementary subtext (e.g. "replies in ~30 min") */
  subtext?: string;
  /** Inline pill style, no subtext support */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable trust signal badge.
 */
export function TrustBadge({ variant, label, subtext, inline = false, style }: TrustBadgeProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const trustConfig = useMemo(() => buildTrustConfig(colors), [colors]);
  const config = trustConfig[variant];
  if (!config) return null;

  const displayLabel = label ?? config.defaultLabel;

  if (inline) {
    return (
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.pageBackground,
            borderRadius: borderRadius.chip,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xxs,
          },
          style,
        ]}
      >
        <MaterialCommunityIcons name={config.icon} size={13} color={config.color} />
        <Text style={[typography.caption, { fontWeight: '600', color: config.color }]}>
          {displayLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.block, { gap: spacing.xxs }, style]}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${config.color}28`,
            borderRadius: borderRadius.icon,
          },
        ]}
      >
        <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.text.primary, fontWeight: '600', textAlign: 'center' },
        ]}
      >
        {displayLabel}
      </Text>
      {subtext ? (
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, textAlign: 'center', fontSize: 11 },
          ]}
        >
          {subtext}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  block: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
