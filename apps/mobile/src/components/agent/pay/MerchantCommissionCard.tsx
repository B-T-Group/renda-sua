import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../common/StatusPill';
import { formatCurrency } from '../../../utils/formatters';
import type { EarningItem, MerchantReferralStructure } from '../../../types/agentPayBoard';

export function MerchantCommissionCard({
  item,
  structure,
}: {
  item: EarningItem;
  structure: MerchantReferralStructure;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const onboarding = structure.onboarding;
  const sameAmount = structure.selfSaleAmount === structure.otherBuyerAmount;
  const paid = item.paymentStatus === 'paid';

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
          {item.title}
        </Text>
        <StatusPill
          compact
          label={paid ? t('agent.pay.paid', 'Paid') : t('agent.pay.unpaid', 'To do')}
          backgroundColor={paid ? colors.successTint : colors.primaryTint}
          textColor={paid ? colors.success.dark : colors.primary.main}
        />
      </View>
      {sameAmount ? (
        <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
          {t('agent.pay.sameSale', '{{amount}} when the first qualifying sale happens', {
            amount: formatCurrency(structure.selfSaleAmount, item.currency),
          })}
        </Text>
      ) : (
        <View style={{ gap: spacing.xxs }}>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {t('agent.pay.selfSale', '{{amount}} if you make the first sale', {
              amount: formatCurrency(structure.selfSaleAmount, item.currency),
            })}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {t('agent.pay.otherSale', '{{amount}} if someone else makes the first sale', {
              amount: formatCurrency(structure.otherBuyerAmount, item.currency),
            })}
          </Text>
        </View>
      )}
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t('agent.pay.salePercent', '{{percent}}% of every sale', { percent: structure.salePercent })}
        {structure.salePercentEarned > 0
          ? ` · ${t('agent.pay.salePercentEarned', '{{amount}} earned', {
              amount: formatCurrency(structure.salePercentEarned, item.currency),
            })}`
          : ''}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t('agent.pay.requirements', '{{approved}}/{{minItems}} items · {{sales}} of {{minSales}} in sales', {
          approved: onboarding.itemsApproved,
          minItems: onboarding.minItems,
          sales: formatCurrency(onboarding.salesTotal, item.currency),
          minSales: formatCurrency(onboarding.minSalesTotal, item.currency),
        })}
      </Text>
      {item.deadline ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('agent.pay.deadline', 'Sale by {{date}}', { date: formatDeadline(item.deadline) })}
        </Text>
      ) : null}
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t(`agent.pay.nextStep.${item.nextStep}`, nextStepFallback(item.nextStep))}
      </Text>
    </View>
  );
}

function formatDeadline(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function nextStepFallback(step: string): string {
  const copy: Record<string, string> = {
    add_items: 'Get at least 2 items approved.',
    reach_sales: 'A qualifying sale still needs to happen before the deadline.',
    awaiting_payout: 'Qualified. The bonus is paid on the Saturday payout.',
    window_closed: 'The sale window has closed, so this bonus will not be paid.',
    paid: 'This bonus has been paid.',
  };
  return copy[step] ?? step;
}

const styles = StyleSheet.create({
  card: {},
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, minWidth: 0 },
});
