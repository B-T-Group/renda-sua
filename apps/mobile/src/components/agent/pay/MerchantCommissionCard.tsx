import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../common/StatusPill';
import { formatCurrency } from '../../../utils/formatters';
import { commissionDeadlineTone, type CommissionDeadlineTone } from '../../../utils/agentPayBoard';
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
  const tone = commissionDeadlineTone(item.deadline, paid || item.nextStep === 'awaiting_payout');
  const status = commissionStatus(paid, tone, t, colors);

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
        <StatusPill compact label={status.label} backgroundColor={status.backgroundColor} textColor={status.textColor} />
      </View>
      <MerchantContacts ownerName={structure.ownerName} phone={structure.phone} email={structure.email} />
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
      {item.deadline ? <DeadlineLine deadline={item.deadline} tone={tone} /> : null}
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t(`agent.pay.nextStep.${item.nextStep}`, nextStepFallback(item.nextStep))}
      </Text>
    </View>
  );
}

function MerchantContacts({
  ownerName,
  phone,
  email,
}: {
  ownerName: string | null;
  phone: string | null;
  email: string | null;
}) {
  const { colors, spacing } = useTheme();
  if (!ownerName && !phone && !email) return null;
  return (
    <View style={{ gap: spacing.xxs }}>
      {ownerName ? <Text variant="bodySmall" style={{ color: colors.text.secondary }}>{ownerName}</Text> : null}
      {phone ? <ContactLink icon="phone" value={phone} href={telHref(phone)} labelKey="agent.pay.callMerchant" fallback="Call {{phone}}" /> : null}
      {email ? <ContactLink icon="email-outline" value={email} href={`mailto:${email}`} labelKey="agent.pay.emailMerchant" fallback="Email {{email}}" /> : null}
    </View>
  );
}

function ContactLink({
  icon,
  value,
  href,
  labelKey,
  fallback,
}: {
  icon: 'phone' | 'email-outline';
  value: string;
  href: string;
  labelKey: string;
  fallback: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey, fallback, { phone: value, email: value })}
      onPress={() => void Linking.openURL(href)}
      style={styles.contact}
    >
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary.main} />
      <Text variant="bodyMedium" style={{ color: colors.primary.main }}>{value}</Text>
    </Pressable>
  );
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function commissionStatus(
  paid: boolean,
  tone: CommissionDeadlineTone,
  t: (key: string, fallback: string) => string,
  colors: { successTint: string; success: { dark: string }; errorTint: string; error: { main: string }; warningTint: string; warning: { dark: string }; primaryTint: string; primary: { main: string } }
) {
  if (paid) return pill(t('agent.pay.paid', 'Paid'), colors.successTint, colors.success.dark);
  if (tone === 'expired') return pill(t('agent.pay.expired', 'Expired'), colors.errorTint, colors.error.main);
  if (tone === 'soon') return pill(t('agent.pay.expiringSoon', 'Expiring soon'), colors.warningTint, colors.warning.dark);
  return pill(t('agent.pay.unpaid', 'To do'), colors.primaryTint, colors.primary.main);
}

function pill(label: string, backgroundColor: string, textColor: string) {
  return { label, backgroundColor, textColor };
}

function DeadlineLine({ deadline, tone }: { deadline: string; tone: CommissionDeadlineTone }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const date = formatDeadline(deadline);
  const color = tone === 'expired' ? colors.error.main : tone === 'soon' ? colors.warning.dark : colors.text.secondary;
  const label =
    tone === 'expired'
      ? t('agent.pay.expired', 'Expired')
      : tone === 'soon'
        ? t('agent.pay.expiringSoon', 'Expiring soon')
        : null;
  return (
    <Text variant="bodySmall" style={{ color }}>
      {label ? `${label} · ` : ''}
      {t('agent.pay.deadline', 'Sale by {{date}}', { date })}
    </Text>
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
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
