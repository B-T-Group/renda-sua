import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Countdown } from '../orders/shared';
import type { DeliveryOrderViewModel } from '../../orders/model';

export interface DeliveryObjectiveHeroProps {
  objective: string;
  nextStepMessage?: string | null;
  urgency?: DeliveryOrderViewModel['urgency'];
}

export function DeliveryObjectiveHero({
  objective,
  nextStepMessage,
  urgency,
}: DeliveryObjectiveHeroProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          borderLeftColor: colors.secondary.main,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
      ]}
    >
      <Text variant="labelMedium" style={{ color: colors.text.secondary, fontWeight: '700' }}>
        {t('orders.nextStep.label', 'Next step')}
      </Text>
      <Text variant="titleLarge" style={{ fontWeight: '800', color: colors.text.primary }}>
        {objective}
      </Text>
      {nextStepMessage ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {nextStepMessage}
        </Text>
      ) : null}
      {urgency?.deadlineAt ? (
        <Countdown
          deadlineAt={urgency.deadlineAt}
          label={urgency.label}
          overdueLabel={t('orders.countdown.overdue', 'Overdue')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderLeftWidth: 6,
  },
});
