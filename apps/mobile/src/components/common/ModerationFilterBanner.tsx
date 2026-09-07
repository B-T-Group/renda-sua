import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface ModerationFilterBannerProps {
  message: string;
  onClear: () => void;
  clearLabel: string;
}

export function ModerationFilterBanner({
  message,
  onClear,
  clearLabel,
}: ModerationFilterBannerProps) {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: `${colors.error.main}12`,
          borderColor: `${colors.error.main}44`,
          borderRadius: borderRadius.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Text variant="bodyMedium" style={{ flex: 1, color: colors.text.primary, minWidth: 0 }}>
        {message}
      </Text>
      <Pressable onPress={onClear} accessibilityRole="button">
        <Text variant="labelLarge" style={{ color: colors.primary.main }}>
          {clearLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
});
