import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

export interface UserMenuRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  /** Short badge label rendered on the trailing edge before the chevron */
  badge?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Replace the chevron with a custom trailing element */
  trailingElement?: React.ReactNode;
}

/**
 * Shared menu row used across Client, Business, and Delivery Agent menus.
 * Renders an icon wrap, label/subtitle body, optional badge, and trailing chevron.
 * Must be placed inside a UserMenuSection for correct border/grouping treatment.
 */
export function UserMenuRow({
  icon,
  label,
  subtitle,
  badge,
  onPress,
  disabled = false,
  trailingElement,
}: UserMenuRowProps) {
  const { colors, borderRadius } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          opacity: pressed && !disabled ? 0.88 : disabled ? 0.45 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.primaryTint,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          color={colors.primary.main}
        />
      </View>

      <View style={styles.body}>
        <Text
          variant="bodyMedium"
          style={[styles.label, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {badge ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.warning.main + '20', borderRadius: 8 },
          ]}
        >
          <Text
            variant="labelSmall"
            style={{ color: colors.warning.dark, fontWeight: '700' }}
          >
            {badge}
          </Text>
        </View>
      ) : null}

      {trailingElement ?? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.text.disabled}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
