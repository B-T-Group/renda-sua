import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export type NoticeTone = 'warning' | 'error' | 'info' | 'success';

export interface NoticeBannerProps {
  tone?: NoticeTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Shows a spinner on the primary action while an async flow runs (e.g. Stripe). */
  actionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Optional extra content rendered below the message (e.g. step lists) */
  children?: React.ReactNode;
}

const DEFAULT_ICON: Record<NoticeTone, keyof typeof MaterialCommunityIcons.glyphMap> = {
  warning: 'alert-outline',
  error: 'alert-circle-outline',
  info: 'information-outline',
  success: 'check-circle-outline',
};

/**
 * High-contrast notice banner that stays legible on iOS and Android.
 * Uses a solid paper background with a colored accent + icon and dark body
 * text (instead of low-contrast tinted text on a tinted background), plus an
 * optional prominent action button.
 */
export function NoticeBanner({
  tone = 'info',
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionLoading,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionLoading,
  style,
  children,
}: NoticeBannerProps) {
  const { colors, borderRadius, spacing, shadows } = useTheme();
  const palette = colors[tone];
  const accent = palette.main;
  const accentDark = palette.dark;

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderLeftColor: accent,
          padding: spacing.sm,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
          <MaterialCommunityIcons name={icon ?? DEFAULT_ICON[tone]} size={20} color={accentDark} />
        </View>
        <View style={styles.textCol}>
          {title ? (
            <Text variant="titleSmall" style={[styles.title, { color: colors.text.primary }]}>
              {title}
            </Text>
          ) : null}
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {message}
          </Text>
        </View>
      </View>

      {children ? <View style={styles.children}>{children}</View> : null}

      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? (
            <Button
              mode="contained"
              onPress={onAction}
              loading={actionLoading}
              disabled={actionLoading}
              buttonColor={accentDark}
              textColor={colors.onDark}
              style={styles.action}
            >
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              mode="outlined"
              onPress={onSecondaryAction}
              loading={secondaryActionLoading}
              disabled={secondaryActionLoading}
              textColor={accentDark}
              style={styles.action}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: { fontWeight: '700', marginBottom: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { alignSelf: 'flex-start' },
  children: { marginTop: 8 },
});
