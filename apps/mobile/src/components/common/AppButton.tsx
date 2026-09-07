import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/theme';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  /** If true shows a spinner and disables press */
  loading?: boolean;
  disabled?: boolean;
  /** Leading icon */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Fills the parent container width */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /** Minimum height: 48dp (spec), defaults to 52 for standard use */
  size?: 'medium' | 'large';
}

function variantStyles(colors: ThemeColors) {
  return {
    primary: {
      container: { backgroundColor: colors.primary.main },
      containerPressed: { backgroundColor: colors.primary.dark },
      label: { color: colors.primary.contrast },
      spinner: colors.primary.contrast,
    },
    secondary: {
      container: { backgroundColor: colors.secondary.main },
      containerPressed: { backgroundColor: colors.secondary.dark },
      label: { color: colors.secondary.contrast },
      spinner: colors.secondary.contrast,
    },
    outline: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary.main,
      },
      containerPressed: { backgroundColor: colors.primary.hover },
      label: { color: colors.primary.main },
      spinner: colors.primary.main,
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      containerPressed: { backgroundColor: colors.primary.hover },
      label: { color: colors.primary.main },
      spinner: colors.primary.main,
    },
    danger: {
      container: { backgroundColor: colors.error.main },
      containerPressed: { backgroundColor: colors.error.dark },
      label: { color: colors.onDark },
      spinner: colors.onDark,
    },
  } as const;
}

/**
 * Design-system button. Enforces min 48dp height (preferred 52dp) and
 * communicates loading / disabled states clearly.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  labelStyle,
  accessibilityLabel,
  size = 'large',
}: AppButtonProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const variants = useMemo(() => variantStyles(colors), [colors]);
  const vStyle = variants[variant];
  const isInert = loading || disabled;
  const height = size === 'large' ? 52 : 48;

  return (
    <Pressable
      onPress={isInert ? undefined : onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={({ pressed }) => [
        {
          borderRadius: borderRadius.button,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          paddingHorizontal: spacing.lg,
          height,
          minHeight: 48,
        },
        vStyle.container,
        fullWidth && styles.fullWidth,
        pressed && !isInert && vStyle.containerPressed,
        isInert && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyle.spinner} />
      ) : (
        <View style={styles.inner}>
          {icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={(vStyle.label as { color: string }).color}
              style={{ marginRight: spacing.xs }}
            />
          ) : null}
          <Text
            style={[
              typography.button,
              { fontSize: 15, fontWeight: '600' },
              vStyle.label,
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<AppButtonProps, 'variant'>) {
  return <AppButton {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<AppButtonProps, 'variant'>) {
  return <AppButton {...props} variant="secondary" />;
}

export function OutlineButton(props: Omit<AppButtonProps, 'variant'>) {
  return <AppButton {...props} variant="outline" />;
}

export function GhostButton(props: Omit<AppButtonProps, 'variant'>) {
  return <AppButton {...props} variant="ghost" />;
}

export function DangerButton(props: Omit<AppButtonProps, 'variant'>) {
  return <AppButton {...props} variant="danger" />;
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
