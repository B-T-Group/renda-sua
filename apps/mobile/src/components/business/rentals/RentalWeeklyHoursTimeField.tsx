import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

export interface RentalWeeklyHoursTimeFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  testID?: string;
}

/** Compact labelled HH:MM input used by the weekly hours editor. */
export function RentalWeeklyHoursTimeField({
  label,
  value,
  placeholder,
  onChangeText,
  onBlur,
  testID,
}: RentalWeeklyHoursTimeFieldProps) {
  const { colors, borderRadius } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={[
          styles.input,
          {
            color: colors.text.primary,
            borderColor: colors.divider,
            backgroundColor: colors.surfaceInput,
            borderRadius: borderRadius.sm,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
