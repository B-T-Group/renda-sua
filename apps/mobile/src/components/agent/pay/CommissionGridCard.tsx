import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrency } from '../../../utils/formatters';
import { CommissionGridIllustration } from './CommissionGridIllustration';
import type { PortfolioCommissionMonth, PortfolioCommissionTier, PortfolioCommissionView } from '../../../types/agentPayBoard';

export function CommissionGridCard({ view }: { view: PortfolioCommissionView }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const title = t('agent.pay.grid.title', 'Portfolio commission');

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
        <CommissionGridIllustration label={title} />
        <View style={styles.copy}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>{title}</Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('agent.pay.grid.base', '{{percent}}% of Rendasua’s item commission', { percent: view.basePercent })}
          </Text>
        </View>
      </View>
      <TierList tiers={view.tiers} currency={view.currency} />
      {view.month ? <MonthLines view={view} month={view.month} /> : null}
    </View>
  );
}

function TierList({ tiers, currency }: { tiers: PortfolioCommissionTier[]; currency: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View>
      {tiers.map((tier) => (
        <Text key={`${tier.minMonthlySales}`} variant="bodySmall" style={{ color: colors.text.secondary }}>
          {tierLine(tier, currency, t)}
        </Text>
      ))}
    </View>
  );
}

function MonthLines({ view, month }: { view: PortfolioCommissionView; month: PortfolioCommissionMonth }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const money = (amount: number) => formatCurrency(amount, view.currency);
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>{monthSummary(month, money, t)}</Text>
      {!month.objectiveMet ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('agent.pay.grid.objective', 'Registration goal missed, so only the base rate is paid.')}
        </Text>
      ) : null}
      <AmountLine label={t('agent.pay.grid.baseAmount', 'Base {{amount}}', { amount: money(month.baseAmount) })} />
      <AmountLine label={growthLine(month, money, t)} />
      <AmountLine label={t('agent.pay.grid.activation', 'Activation {{amount}}', { amount: money(month.activationPaid) })} />
      <AmountLine label={fastStartLine(month, money, t)} />
      <AmountLine label={quarterlyLine(month, money, t)} />
      <AmountLine label={t('agent.pay.grid.payable', 'To pay {{amount}}', { amount: money(month.payableAmount) })} />
      <AmountLine label={holdLine(view, month, money, t)} />
      {month.holdReleaseAt ? <AmountLine label={releaseLine(month.holdReleaseAt, t)} /> : null}
      <AmountLine label={t('agent.pay.grid.recruitment', 'Recruitment outside the cap {{amount}}', { amount: money(month.recruitmentAmount) })} />
    </View>
  );
}

function AmountLine({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text variant="bodySmall" style={{ color: colors.text.primary }}>{label}</Text>;
}

function tierLine(
  tier: PortfolioCommissionTier,
  currency: string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  const from = formatCurrency(tier.minMonthlySales, currency);
  if (tier.maxMonthlySales == null) {
    return t('agent.pay.grid.tierOpen', '{{from}} and above: +{{percent}}%', { from, percent: tier.bonusPercent });
  }
  const to = formatCurrency(tier.maxMonthlySales, currency);
  return t('agent.pay.grid.tier', '{{from}} to {{to}}: +{{percent}}%', { from, to, percent: tier.bonusPercent });
}

function monthSummary(
  month: PortfolioCommissionMonth,
  money: (amount: number) => string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.month', 'This month: {{gmv}} sales · {{eligible}} eligible · {{registrations}}/{{target}} registrations', {
    gmv: money(month.gmv),
    eligible: money(month.eligible),
    registrations: month.registrations,
    target: month.registrationTarget,
  });
}

function growthLine(
  month: PortfolioCommissionMonth,
  money: (amount: number) => string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.growth', 'Growth +{{percent}}% · {{amount}}', {
    percent: month.growthPercent,
    amount: money(month.growthAmount),
  });
}

function fastStartLine(
  month: PortfolioCommissionMonth,
  money: (amount: number) => string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.fastStart', 'Fast start earned {{earned}}, paid {{paid}}', {
    earned: money(month.fastStartEarned),
    paid: money(month.fastStartPaid),
  });
}

function quarterlyLine(
  month: PortfolioCommissionMonth,
  money: (amount: number) => string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.quarterly', 'Quarterly earned {{earned}}, paid {{paid}}', {
    earned: money(month.quarterlyEarned),
    paid: money(month.quarterlyPaid),
  });
}

function holdLine(
  view: PortfolioCommissionView,
  month: PortfolioCommissionMonth,
  money: (amount: number) => string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.hold', 'Hold {{amount}} for {{days}} days', {
    amount: money(month.holdAmount),
    days: view.holdDays,
  });
}

function releaseLine(
  value: string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  return t('agent.pay.grid.release', 'Releases {{date}}', { date: formatRelease(value) });
}

function formatRelease(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: {},
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
});
