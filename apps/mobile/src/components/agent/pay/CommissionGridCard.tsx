import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrency } from '../../../utils/formatters';
import { CommissionGridIllustration } from './CommissionGridIllustration';
import type { PortfolioCommissionMonth, PortfolioCommissionTier, PortfolioCommissionView } from '../../../types/agentPayBoard';

type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export function CommissionGridCard({
  view,
  onRefer,
}: {
  view: PortfolioCommissionView;
  onRefer?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const title = t('agent.pay.grid.title', 'Portfolio commission');

  return (
    <View style={[shadows.sm, cardChrome(colors.surface, borderRadius.lg, spacing.md)]}>
      <View style={styles.header}>
        <CommissionGridIllustration label={title} size={48} />
        <View style={styles.copy}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>{title}</Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('agent.pay.grid.base', '{{percent}}% of item commission', { percent: view.basePercent })}
          </Text>
        </View>
      </View>
      {view.month ? <MonthSummary view={view} month={view.month} onRefer={onRefer} /> : (
        <NextAction view={view} month={null} onRefer={onRefer} />
      )}
      <RateLadder tiers={view.tiers} gmv={view.month?.gmv ?? 0} />
    </View>
  );
}

function MonthSummary({
  view,
  month,
  onRefer,
}: {
  view: PortfolioCommissionView;
  month: PortfolioCommissionMonth;
  onRefer?: () => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const money = (amount: number) => formatCurrency(amount, view.currency);
  const lines = bonusLines(month, money, t as Translate);
  return (
    <View style={{ gap: spacing.sm }}>
      <PayFigure amount={money(month.payableAmount)} hold={holdCaption(view, month, money, t as Translate)} />
      <StatRow month={month} />
      {lines.map((line) => (
        <MoneyRow key={line.key} label={line.label} value={line.value} />
      ))}
      <NextAction view={view} month={month} onRefer={onRefer} />
    </View>
  );
}

function PayFigure({ amount, hold }: { amount: string; hold: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.pay}>
      <Text variant="headlineSmall" style={[styles.payAmount, { color: colors.text.primary }]}>{amount}</Text>
      <Text variant="labelLarge" style={{ color: colors.text.secondary }}>{t('agent.pay.grid.toPay', 'To pay')}</Text>
      {hold ? <Text variant="bodySmall" style={{ color: colors.text.secondary }}>{hold}</Text> : null}
    </View>
  );
}

function StatRow({ month }: { month: PortfolioCommissionMonth }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signupTone = month.objectiveMet ? colors.success.main : colors.warning.main;
  return (
    <View style={styles.stats}>
      <Stat value={grouped(month.gmv)} label={t('agent.pay.grid.sales', 'Sales')} />
      <Stat value={grouped(month.eligible)} label={t('agent.pay.grid.eligible', 'Eligible')} />
      <Stat
        value={`${month.registrations}/${month.registrationTarget}`}
        label={t('agent.pay.grid.signups', 'Sign-ups')}
        tone={signupTone}
      />
    </View>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  const { colors, borderRadius } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceInput, borderRadius: borderRadius.chip }]}>
      <Text variant="titleSmall" numberOfLines={1} style={{ color: tone ?? colors.text.primary }}>{value}</Text>
      <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.text.secondary }}>{label}</Text>
    </View>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.moneyRow}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>{label}</Text>
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>{value}</Text>
    </View>
  );
}

function RateLadder({ tiers, gmv }: { tiers: PortfolioCommissionTier[]; gmv: number }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const current = tierForSales(tiers, gmv);
  if (tiers.length === 0) return null;
  return (
    <View style={[styles.rates, { borderTopColor: colors.divider }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.rateToggle}
      >
        <Text variant="labelLarge" style={{ color: colors.text.primary }}>
          {t('agent.pay.grid.salesBonus', 'Sales bonus +{{percent}}%', { percent: current?.bonusPercent ?? 0 })}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text.secondary} />
      </Pressable>
      {open ? tiers.map((tier) => <TierRow key={tier.minMonthlySales} tier={tier} active={tier === current} />) : null}
    </View>
  );
}

function TierRow({ tier, active }: { tier: PortfolioCommissionTier; active: boolean }) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <View style={[styles.tier, active ? { backgroundColor: colors.surfaceSelected, borderRadius: borderRadius.chip } : null]}>
      <Text variant="bodySmall" style={{ color: colors.text.primary }}>{tierRange(tier)}</Text>
      <Text variant="labelLarge" style={{ color: active ? colors.primary.main : colors.text.secondary }}>
        {t('agent.pay.grid.plusPercent', '+{{percent}}%', { percent: tier.bonusPercent })}
      </Text>
    </View>
  );
}

function NextAction({
  view,
  month,
  onRefer,
}: {
  view: PortfolioCommissionView;
  month: PortfolioCommissionMonth | null;
  onRefer?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const step = commissionNextStep(view, month);
  const copy = nextCopy(step, view.basePercent, t as Translate);
  return (
    <View style={[styles.next, { backgroundColor: colors.primarySubtle, borderRadius: borderRadius.chip }]}>
      <Text variant="labelSmall" style={{ color: colors.primary.main }}>{t('agent.pay.grid.next', 'Do this next')}</Text>
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>{copy.title}</Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>{copy.detail}</Text>
      {copy.action && onRefer ? <ReferButton onPress={onRefer} /> : null}
    </View>
  );
}

function ReferButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.nextButton}>
      <Text variant="labelLarge" style={{ color: colors.primary.main }}>
        {t('agent.pay.grid.referAction', 'Refer a shop')}
      </Text>
    </Pressable>
  );
}

function commissionNextStep(view: PortfolioCommissionView, month: PortfolioCommissionMonth | null): NextStep {
  if (!month || (month.gmv <= 0 && month.registrations <= 0)) return { kind: 'refer' };
  if (month.gmv <= 0) return { kind: 'sell' };
  const left = Math.max(0, month.registrationsNeeded - month.registrations);
  if (left > 0) return { kind: 'signups', left };
  const upcoming = nextPaidTier(view.tiers, month.gmv);
  if (!upcoming) return { kind: 'top' };
  return { kind: 'sales', gap: upcoming.minMonthlySales - month.gmv, percent: upcoming.bonusPercent };
}

function nextCopy(step: NextStep, percent: number, t: Translate) {
  if (step.kind === 'refer') return stepCopy(t, 'referTitle', 'Refer a shop', 'referDetail', 'You earn {{percent}}% of its item commission', { percent }, true);
  if (step.kind === 'sell') return stepCopy(t, 'sellTitle', 'Get a shop to make a sale', 'sellDetail', 'You earn {{percent}}% of the item commission', { percent }, false);
  if (step.kind === 'signups') {
    return stepCopy(t, 'signupsTitle', 'Sign up {{shops}} more shops', 'signupsDetail', 'Bonuses stay off until then', { shops: step.left }, true);
  }
  if (step.kind === 'sales') return stepCopy(t, 'salesTitle', '{{amount}} more in sales', 'salesDetail', 'Unlocks +{{percent}}%', { amount: grouped(step.gap), percent: step.percent }, false);
  return stepCopy(t, 'topTitle', 'Highest sales bonus is on', 'topDetail', 'Keep your shops selling', {}, false);
}

function stepCopy(
  t: Translate,
  titleKey: string,
  title: string,
  detailKey: string,
  detail: string,
  options: Record<string, unknown>,
  action: boolean
) {
  return {
    title: t(`agent.pay.grid.${titleKey}`, title, options),
    detail: t(`agent.pay.grid.${detailKey}`, detail, options),
    action,
  };
}

function nextPaidTier(tiers: PortfolioCommissionTier[], gmv: number) {
  return [...tiers]
    .filter((tier) => tier.minMonthlySales > gmv && tier.bonusPercent > 0)
    .sort((a, b) => a.minMonthlySales - b.minMonthlySales)[0];
}

type NextStep =
  | { kind: 'refer' }
  | { kind: 'sell' }
  | { kind: 'signups'; left: number }
  | { kind: 'sales'; gap: number; percent: number }
  | { kind: 'top' };

function cardChrome(backgroundColor: string, radius: number, padding: number) {
  return { backgroundColor, borderRadius: radius, padding, marginHorizontal: padding, marginBottom: 12, gap: 12 };
}

function holdCaption(view: PortfolioCommissionView, month: PortfolioCommissionMonth, money: (amount: number) => string, t: Translate) {
  if (month.holdAmount <= 0) return null;
  const amount = money(month.holdAmount);
  if (!month.holdReleaseAt) {
    return t('agent.pay.grid.heldFor', '{{amount}} held for {{days}} days', { amount, days: view.holdDays });
  }
  return t('agent.pay.grid.heldUntil', '{{amount}} held until {{date}}', { amount, date: formatRelease(month.holdReleaseAt) });
}

function bonusLines(month: PortfolioCommissionMonth, money: (amount: number) => string, t: Translate) {
  return [
    ...growthLines(month, money, t),
    ...paidLine('activation', month.activationPaid, t('agent.pay.grid.activationLabel', 'Activation'), money),
    ...shownLine('fast', month.fastStartEarned, month.fastStartPaid, t('agent.pay.grid.fastStartLabel', 'Fast start'), money),
    ...shownLine('quarter', month.quarterlyEarned, month.quarterlyPaid, t('agent.pay.grid.quarterlyLabel', 'Quarterly'), money),
    ...paidLine('recruit', month.recruitmentAmount, t('agent.pay.grid.recruitmentLabel', 'Recruitment'), money),
  ];
}

function growthLines(month: PortfolioCommissionMonth, money: (amount: number) => string, t: Translate) {
  if (month.growthAmount <= 0) return [];
  return [
    { key: 'base', label: t('agent.pay.grid.baseLabel', 'Base'), value: money(month.baseAmount) },
    {
      key: 'growth',
      label: t('agent.pay.grid.growthLabel', 'Growth +{{percent}}%', { percent: month.growthPercent }),
      value: money(month.growthAmount),
    },
  ];
}

function paidLine(key: string, amount: number, label: string, money: (amount: number) => string) {
  if (amount <= 0) return [];
  return [{ key, label, value: money(amount) }];
}

function shownLine(key: string, earned: number, paid: number, label: string, money: (amount: number) => string) {
  if (earned <= 0 && paid <= 0) return [];
  return [{ key, label, value: money(paid) }];
}

function tierForSales(tiers: PortfolioCommissionTier[], gmv: number) {
  return tiers.find((tier) => gmv >= tier.minMonthlySales && (tier.maxMonthlySales == null || gmv <= tier.maxMonthlySales));
}

function tierRange(tier: PortfolioCommissionTier) {
  const from = compactSales(tier.minMonthlySales);
  if (tier.maxMonthlySales == null) return `${from}+`;
  return `${from} – ${compactSales(tier.maxMonthlySales)}`;
}

function compactSales(amount: number) {
  if (amount < 1_000_000) return grouped(amount);
  const millions = Math.round((amount / 1_000_000) * 10) / 10;
  const text = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(millions);
  return `${text} M`;
}

function grouped(amount: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
}

function formatRelease(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  pay: { gap: 2 },
  payAmount: { fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, gap: 2 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rates: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  rateToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  tier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  next: { padding: 12, gap: 2 },
  nextButton: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
});
