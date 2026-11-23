import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalJourney, type JourneyInput } from '../../utils/rentals/rentalJourney';

export function RentalJourneyList(input: JourneyInput & { accent?: string; hideTitle?: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const steps = rentalJourney(input);
  return (
    <View style={{ gap: spacing.xs }}>
      {input.hideTitle ? null : (
        <Text style={[typography.subtitle2, { color: colors.text.primary }]}>{t('rentals.status', 'Status')}</Text>
      )}
      {steps.map((step) => (
        <JourneyRow
          key={step.key}
          label={t(step.labelKey, step.label)}
          state={step.state}
          aside={step.aside}
          accent={input.accent ?? colors.primary.main}
        />
      ))}
    </View>
  );
}

function JourneyRow({
  label,
  state,
  aside,
  accent,
}: {
  label: string;
  state: 'done' | 'current' | 'upcoming';
  aside?: string;
  accent: string;
}) {
  const { colors, typography } = useTheme();
  const color = state === 'upcoming' ? colors.text.disabled : colors.text.primary;
  return (
    <View style={styles.row}>
      <StepIcon state={state} accent={accent} done={colors.success.main} muted={colors.text.disabled} />
      <Text style={[typography.body2, styles.label, { color, fontWeight: state === 'current' ? '700' : '400' }]}>{label}</Text>
      {aside ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{aside}</Text> : null}
    </View>
  );
}

function StepIcon({
  state,
  accent,
  done,
  muted,
}: {
  state: 'done' | 'current' | 'upcoming';
  accent: string;
  done: string;
  muted: string;
}) {
  if (state === 'current') {
    return <MaterialCommunityIcons name="circle-slice-8" size={18} color={accent} />;
  }
  const name = state === 'done' ? 'check-circle' : 'circle-outline';
  return <MaterialCommunityIcons name={name} size={18} color={state === 'done' ? done : muted} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 28, gap: 8 },
  label: { flex: 1 },
});
