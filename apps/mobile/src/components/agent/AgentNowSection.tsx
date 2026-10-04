import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAgentActiveDelivery } from '@/contexts/AgentActiveDeliveryContext';
import { useAgentEarningsSummary } from '@/hooks/useAgentEarningsSummary';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/utils/formatters';
import type { ClaimReadiness } from '@/utils/claimReadiness';
import { AppText } from '../common/AppText';
import { PriceText } from '../common/PriceText';

type Props = { readiness?: ClaimReadiness | null };

/** What the agent should do right now: active delivery, setup, then today's numbers. */
export function AgentNowSection({ readiness }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const { activeOrder: active } = useAgentActiveDelivery();
  const { summary } = useAgentEarningsSummary();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
      {active ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (navigation as { navigate: (name: string) => void }).navigate('Orders')}
          style={{ backgroundColor: colors.primary.main, borderRadius: borderRadius.card, padding: spacing.md, marginBottom: spacing.sm }}
        >
          <AppText role="label" color={colors.primary.contrast}>
            {t('agent.now.active', 'Active delivery')}
          </AppText>
          <AppText role="h3" color={colors.primary.contrast} style={{ marginTop: spacing.xxs }}>
            {active.business_location?.name || t('agent.now.openDelivery', 'Open this delivery')}
          </AppText>
        </Pressable>
      ) : readiness ? (
        <View style={{ backgroundColor: colors.surfaceSelected, borderRadius: borderRadius.card, padding: spacing.md, marginBottom: spacing.sm }}>
          <AppText role="h3">{t(readiness.titleKey, readiness.titleDefault)}</AppText>
          <AppText role="bodySmall" style={{ marginTop: spacing.xxs }}>
            {t(readiness.bodyKey, readiness.bodyDefault)}
          </AppText>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText role="caption">{t('agent.now.deliveries', 'Deliveries today')}</AppText>
          <AppText role="h2">{String(summary?.todayDeliveryCount ?? 0)}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText role="caption">{t('agent.now.earnings', 'Earnings today')}</AppText>
          {summary ? (
            <PriceText amount={summary.todayEarnings} currency={summary.currency} />
          ) : (
            <AppText role="h2">{formatCurrency(0, 'XAF')}</AppText>
          )}
        </View>
      </View>
    </View>
  );
}
