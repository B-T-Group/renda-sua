import React from 'react';
import { Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface SubtleExtendedFabProps {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function SubtleExtendedFab({
  label,
  onPress,
  icon = 'plus',
  accessibilityLabel,
  style,
}: SubtleExtendedFabProps) {
  const { colors, borderRadius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          opacity: pressed ? 0.9 : 1,
        },
        Platform.OS === 'ios'
          ? {
              shadowColor: colors.primary.dark,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
            }
          : Platform.OS === 'android'
            ? { elevation: 1 }
            : null,
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary.main} />
      <Text variant="labelMedium" style={{ color: colors.text.secondary, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
