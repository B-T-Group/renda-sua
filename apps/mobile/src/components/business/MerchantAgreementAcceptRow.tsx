import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

const CHECKBOX_SIZE = 28;

type Props = {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function MerchantAgreementAcceptRow({
  label,
  hint,
  checked,
  onToggle,
  disabled = false,
}: Props) {
  const { colors, spacing, borderRadius } = useTheme();
  const iconName = checked ? 'checkbox-marked' : 'checkbox-blank-outline';
  const iconColor = checked ? colors.primary.main : colors.text.secondary;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.row,
          {
            borderRadius: borderRadius.md,
            borderWidth: 2,
            borderColor: checked ? colors.primary.main : colors.border,
            backgroundColor: checked
              ? 'rgba(30, 64, 175, 0.08)'
              : pressed
                ? 'rgba(29, 29, 31, 0.06)'
                : colors.surface,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={CHECKBOX_SIZE}
          color={iconColor}
          style={styles.icon}
        />
        <Text variant="bodyLarge" style={[styles.label, { color: colors.text.primary }]}>
          {label}
        </Text>
      </Pressable>
      {hint ? (
        <HelperText type="info" visible style={styles.hint}>
          {hint}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  icon: { marginRight: 12 },
  label: { flex: 1, fontWeight: '600' },
  hint: { marginTop: 4, paddingHorizontal: 4 },
});
