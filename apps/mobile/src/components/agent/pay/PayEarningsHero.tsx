import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { PriceText } from '../../common/PriceText';
import { formatCurrency } from '../../../utils/formatters';
import type { PayBoardSummary } from '../../../types/agentPayBoard';

const SOURCE_FALLBACK: Record<string, string> = {
  merchant_referral: 'Referral bonuses',
  sale_percent: 'Percent of sales',
  payment_schedule: 'Scheduled pay',
  delivery_commission: 'Deliveries',
};

export function PayEarningsHero({ summary }: { summary: PayBoardSummary | null }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const currency = summary?.currency ?? 'XAF';
  const sources = (summary?.sources ?? []).filter(
    (source) => source.earnedAmount > 0 || source.pendingAmount > 0
  );

  return (
    <View
      style={[
        styles.hero,
        shadows.sm,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      <Text variant="labelLarge" style={{ color: colors.text.secondary }}>
        {t('agent.pay.earnedLabel', 'Earned so far')}
      </Text>
      <PriceText amount={summary?.earnedAmount ?? 0} currency={currency} size="lg" />
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t('agent.pay.pendingLabel', '{{amount}} waiting to be paid', {
          amount: formatCurrency(summary?.pendingAmount ?? 0, currency),
        })}
      </Text>
      {sources.map((source) => (
        <Text key={source.kind} variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t(`agent.pay.sources.${source.kind}`, SOURCE_FALLBACK[source.kind] ?? source.kind)}
          {' · '}
          {formatCurrency(source.earnedAmount, currency)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {},
});
