import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  DEDICATED_DECLINE_REASONS,
  type DedicatedDeclineReason,
} from '../../utils/dedicatedRelease';

const REASON_DEFAULTS: Record<DedicatedDeclineReason, string> = {
  too_far: 'Too far',
  busy: "I'm busy",
  not_enough_balance: 'Not enough balance',
  other: 'Other',
};

interface Props {
  value: DedicatedDeclineReason | null;
  onChange: (reason: DedicatedDeclineReason | null) => void;
  disabled?: boolean;
}

/**
 * Optional reason picker for "Can't take this" (#664). Inline chips rather than a dialog so it
 * also works inside the full-screen offer modal. Tap the selected chip again to clear it.
 */
export function DeclineReasonChips({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View>
      <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
        {t('dedicatedAgents.agent.reasonPrompt', 'Why? (optional)')}
      </Text>
      <View style={styles.row}>
        {DEDICATED_DECLINE_REASONS.map((reason) => {
          const selected = value === reason;
          const label = t(`dedicatedAgents.agent.reasons.${reason}`, REASON_DEFAULTS[reason]);
          return (
            <Pressable
              key={reason}
              disabled={disabled}
              onPress={() => onChange(selected ? null : reason)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={label}
              style={{
                borderWidth: 1,
                borderRadius: borderRadius.chip,
                borderColor: selected ? colors.primary.main : colors.divider,
                backgroundColor: selected ? colors.primaryTint : colors.surface,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Text
                variant="labelLarge"
                style={{ color: selected ? colors.primary.dark : colors.text.primary }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
