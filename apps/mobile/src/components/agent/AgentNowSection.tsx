import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterRise } from '@/theme/motionHooks';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAgentActiveDelivery } from '@/contexts/AgentActiveDeliveryContext';
import { useAgentEarningsSummary } from '@/hooks/useAgentEarningsSummary';
import { useTheme } from '@/contexts/ThemeContext';
import type { ClaimReadiness } from '@/utils/claimReadiness';
import { AppText } from '../common/AppText';

type Props = {
  readiness?: ClaimReadiness | null;
  hideActiveDeliveryCard?: boolean;
};

/** What the agent should do right now: active delivery, setup, then today's delivery count. */
export function AgentNowSection({ readiness, hideActiveDeliveryCard }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const { activeOrder: active } = useAgentActiveDelivery();
  const { summary } = useAgentEarningsSummary();
  const showHero = Boolean(active) && !hideActiveDeliveryCard;
  return (
    <Animated.View entering={enterRise} style={{ paddingBottom: spacing.xs }}>
      {showHero ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (navigation as { navigate: (name: string) => void }).navigate('Orders')}
          style={{
            backgroundColor: colors.primary.main,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <AppText role="label" color={colors.primary.contrast}>
            {t('agent.now.active', 'Active delivery')}
          </AppText>
          <AppText role="body" color={colors.primary.contrast} style={{ marginTop: 2, fontWeight: '700' }}>
            {active?.business_location?.name || t('agent.now.openDelivery', 'Open this delivery')}
          </AppText>
        </Pressable>
      ) : readiness ? (
        <View
          style={{
            backgroundColor: colors.surfaceSelected,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <AppText role="body" style={{ fontWeight: '700' }}>
            {t(readiness.titleKey, readiness.titleDefault)}
          </AppText>
          <AppText role="bodySmall" style={{ marginTop: 2 }}>
            {t(readiness.bodyKey, readiness.bodyDefault)}
          </AppText>
        </View>
      ) : null}
      <View>
        <AppText role="caption">{t('agent.now.deliveries', 'Deliveries today')}</AppText>
        <AppText role="h3" style={{ marginTop: 2 }}>
          {String(summary?.todayDeliveryCount ?? 0)}
        </AppText>
      </View>
    </Animated.View>
  );
}
