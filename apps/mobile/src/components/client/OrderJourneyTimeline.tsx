import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme/motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveOrderPhase, type OrderPhaseInput } from '@/utils/orderPhase';
import { AppText } from '../common/AppText';

const DELIVERY_STEPS = ['placed', 'confirmed', 'preparing', 'on_the_way', 'delivered'] as const;

type Props = {
  input: OrderPhaseInput;
  agentName?: string | null;
};

/** A short narrative of where the order is, without raw status enums. */
export function OrderJourneyTimeline({ input, agentName }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const phase = resolveOrderPhase(input, 'client');
  const active = activeIndex(phase.phase);
  const fill = useSharedValue(active / (DELIVERY_STEPS.length - 1));
  useEffect(() => {
    fill.value = withTiming(active / (DELIVERY_STEPS.length - 1), { duration: motion.duration.slow });
  }, [active, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%` }));
  const message = journeyMessage(
    t as (key: string, fallback: string, options?: Record<string, string>) => string,
    phase.phase,
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
        {DELIVERY_STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View
              style={[
                styles.dot,
                { backgroundColor: index <= active ? colors.primary.main : colors.border },
              ]}
            />
            <AppText role="caption" style={{ textAlign: 'center', marginTop: spacing.xxs }}>
              {t(`client.journey.${step}`, defaultLabel(step))}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function activeIndex(phase: string): number {
  if (phase === 'done') return 4;
  if (phase === 'in_delivery') return 3;
  if (phase === 'ready' || phase === 'prepare') return 2;
  if (phase === 'confirm') return 1;
  return 0;
}

function defaultLabel(step: (typeof DELIVERY_STEPS)[number]): string {
  if (step === 'placed') return 'Placed';
  if (step === 'confirmed') return 'Confirmed';
  if (step === 'preparing') return 'Preparing';
  if (step === 'on_the_way') return 'On the way';
  return 'Delivered';
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
  agentName?: string | null,
  status?: string | null
): string {
  if (phase === 'in_delivery') return deliveryMessage(t, agentName, status);
  if (phase === 'prepare' || phase === 'ready') return t('client.journey.messagePreparing', 'Your order is being prepared.');
  if (phase === 'done') return t('client.journey.messageDelivered', 'Your order was delivered.');
  if (phase === 'pay') return t('client.journey.pay', 'Payment is the next step.');
  return t('client.journey.messagePlaced', 'Your order is with the store.');
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
