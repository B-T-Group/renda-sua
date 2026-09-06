import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export type WelcomeNextStep = {
  label: string;
  done?: boolean;
};

function StepRow({ step, index }: { step: WelcomeNextStep; index: number }) {
  const { colors, spacing, borderRadius } = useTheme();
  const done = Boolean(step.done);
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <View
        style={[
          styles.marker,
          {
            borderRadius: borderRadius.full,
            backgroundColor: done ? colors.success.main : colors.primaryTint,
          },
        ]}
      >
        {done ? (
          <MaterialCommunityIcons name="check" size={14} color={colors.primary.contrast} />
        ) : (
          <Text variant="labelSmall" style={{ color: colors.primary.main, fontWeight: '700' }}>
            {index}
          </Text>
        )}
      </View>
      <Text
        variant="bodyMedium"
        style={{
          flex: 1,
          minWidth: 0,
          color: done ? colors.text.primary : colors.text.secondary,
          fontWeight: done ? '700' : '500',
        }}
      >
        {step.label}
      </Text>
    </View>
  );
}

export function SignupWelcomeNextSteps({ steps }: { steps: WelcomeNextStep[] }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('auth.signupWelcome.nextTitle', "What's next")}
      </Text>
      {steps.map((step, i) => (
        <StepRow key={step.label} step={step} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
  marker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
