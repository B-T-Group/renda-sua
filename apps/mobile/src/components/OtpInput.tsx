import React, { useCallback, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type OtpInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Saisie OTP en cases (chiffres), focus auto, retour arrière vers la case précédente.
 * Coller un code complet dans une case remplit tout le champ.
 */
export function OtpInput({ length, value, onChange, disabled }: OtpInputProps) {
  const { colors, typography, borderRadius } = useTheme();
  const refs = useRef<(TextInput | null)[]>([]);

  const digitsOnly = value.replace(/\D/g, '').slice(0, length);

  const applyFullCode = useCallback(
    (raw: string) => {
      const d = raw.replace(/\D/g, '').slice(0, length);
      onChange(d);
      const focusAt = Math.min(d.length, length - 1);
      requestAnimationFrame(() => refs.current[focusAt]?.focus());
    },
    [length, onChange]
  );

  const handleChangeAt = useCallback(
    (index: number, text: string) => {
      if (disabled) return;
      if (text.length > 1) {
        applyFullCode(text);
        return;
      }
      if (text === '') {
        const next = `${digitsOnly.slice(0, index)}${digitsOnly.slice(index + 1)}`;
        onChange(next);
        return;
      }
      const digit = text.replace(/\D/g, '').slice(-1);
      const prefix = digitsOnly.slice(0, index);
      const suffix = digitsOnly.slice(index + 1);
      const next = `${prefix}${digit}${suffix}`.slice(0, length);
      onChange(next);
      if (digit && index < length - 1) {
        refs.current[index + 1]?.focus();
      }
    },
    [applyFullCode, digitsOnly, disabled, length, onChange]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key !== 'Backspace') return;
      if (digitsOnly[index]) return;
      if (index > 0) {
        const next = `${digitsOnly.slice(0, index - 1)}${digitsOnly.slice(index)}`.slice(0, length);
        onChange(next);
        refs.current[index - 1]?.focus();
      }
    },
    [digitsOnly, length, onChange]
  );

  return (
    <View style={styles.row} accessibilityRole="none">
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={[
            styles.cell,
            {
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surface,
              color: colors.text.primary,
            },
            typography.h5,
          ]}
          value={digitsOnly[i] ?? ''}
          onChangeText={(t) => handleChangeAt(i, t)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={length}
          editable={!disabled}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          accessibilityLabel={`OTP digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  cell: {
    width: 48,
    height: 52,
    textAlign: 'center',
    borderWidth: 1.5,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});
