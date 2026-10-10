import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../common/StatusPill';
import { ObjectiveProgressList } from '../ObjectiveProgressList';
import { formatCurrency } from '../../../utils/formatters';
import { progressFromObjectives } from '../../../utils/agentPayBoard';
import type { EarningItem, PaymentScheduleStructure } from '../../../types/agentPayBoard';

export function ScheduleObjectiveCard({
  item,
  structure,
}: {
  item: EarningItem;
  structure: PaymentScheduleStructure;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const paid = item.paymentStatus === 'paid';
  const title = item.title || t('agent.pay.planFallback', 'Payment plan');

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium" numberOfLines={2} style={[styles.title, { color: colors.text.primary }]}>
          {title}
        </Text>
        <StatusPill
          compact
          label={paid ? t('agent.pay.goalsMet', 'Goals met') : t('agent.pay.inProgress', 'In progress')}
          backgroundColor={paid ? colors.successTint : colors.primaryTint}
          textColor={paid ? colors.success.dark : colors.primary.main}
        />
      </View>
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t('agent.pay.stipend', '{{amount}} {{frequency}}', {
          amount: formatCurrency(structure.stipendAmount, item.currency),
          frequency: t(`agent.pay.frequency.${structure.frequency}`, structure.frequency),
        })}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t('agent.pay.stipendNote', 'The stipend is paid on schedule. These goals do not hold it back.')}
      </Text>
      <ObjectiveProgressList
        progress={progressFromObjectives(structure.objectives)}
        currency={item.currency}
        showPercent
      />
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t(`agent.pay.nextStep.${item.nextStep}`, nextStepFallback(item.nextStep))}
      </Text>
    </View>
  );
}

function nextStepFallback(step: string): string {
  if (step === 'objectives_met') return 'Every goal on this plan is met.';
  return 'Keep going on the goal that is furthest behind.';
}

const styles = StyleSheet.create({
  card: {},
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, minWidth: 0 },
});
