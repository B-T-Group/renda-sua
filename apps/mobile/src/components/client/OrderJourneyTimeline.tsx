import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme/motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import {
  clientJourneyActiveIndex,
  clientJourneyMessage,
  clientJourneyStepFallback,
  clientJourneySteps,
  isClientJourneyPickup,
  resolveOrderPhase,
  type OrderPhaseInput,
} from '@/utils/orderPhase';
import { AppText } from '../common/AppText';

type Props = {
  input: OrderPhaseInput;
  agentName?: string | null;
};

/** A short narrative of where the order is, without raw status enums. */
export function OrderJourneyTimeline({ input, agentName }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const pickup = isClientJourneyPickup(input);
  const steps = clientJourneySteps(pickup);
  const phase = resolveOrderPhase(input, 'client');
  const active = clientJourneyActiveIndex(phase.phase, steps.length);
  const fill = useSharedValue(active / (steps.length - 1));
  useEffect(() => {
    fill.value = withTiming(active / (steps.length - 1), { duration: motion.duration.slow });
  }, [active, fill, steps.length]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%` }));
  const message = journeyMessage(
    t as (key: string, fallback: string, options?: Record<string, string>) => string,
    phase.phase,
    pickup,
    agentName,
    input.status
  );
  return (
    <View style={{ paddingVertical: spacing.sm }}>
      <AppText role="h3">{message}</AppText>
      <View style={[styles.track, { backgroundColor: colors.border, marginTop: spacing.md }]}>
        <Animated.View style={[styles.fill, bar, { backgroundColor: colors.primary.main }]} />
      </View>
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View
              style={[
                styles.dot,
                { backgroundColor: index <= active ? colors.primary.main : colors.border },
              ]}
            />
            <AppText role="caption" style={{ textAlign: 'center', marginTop: spacing.xxs }}>
              {t(`client.journey.${step}`, clientJourneyStepFallback(step))}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function deliveryMessage(
  t: (key: string, fallback: string, options?: Record<string, string>) => string,
  agentName?: string | null,
  status?: string | null
): string {
  if (status === 'assigned_to_agent') {
    return agentName
      ? t('client.orderJourney.claimed.nowNamed', '{{agentName}} just claimed your order and is heading to pick it up.', { agentName })
      : t('client.orderJourney.claimed.now', 'A delivery agent claimed your order and is heading to pick it up.');
  }
  if (status === 'picked_up' || status === 'in_transit') {
    return agentName
      ? t('client.orderJourney.onTheWay.nowNamed', '{{agentName}} picked up your order and is coming to you.', { agentName })
      : t('client.orderJourney.onTheWay.now', 'Your delivery person picked up your order and is coming to you.');
  }
  if (status === 'out_for_delivery') {
    return agentName
      ? t('client.orderJourney.outForDelivery.nowNamed', '{{agentName}} is out for delivery and will arrive soon.', { agentName })
      : t('client.orderJourney.outForDelivery.now', 'Your order is out for delivery and will arrive soon.');
  }
  return t('client.journey.onTheWay', 'Your order is on the way.');
}

function journeyMessage(
  t: (key: string, fallback: string, options?: Record<string, string>) => string,
  phase: string,
  pickup: boolean,
  agentName?: string | null,
  status?: string | null
): string {
  if (phase === 'in_delivery' && !pickup) return deliveryMessage(t, agentName, status);
  const copy = clientJourneyMessage(phase, pickup);
  return t(copy.key, copy.fallback);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
