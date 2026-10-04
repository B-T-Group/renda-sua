import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';

type Props = {
  phase: string;
  status?: string | null;
  fulfillment?: string | null;
  agentName?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  onOpenMap?: () => void;
  onPin?: () => void;
};

function deliveryCopy(
  status: string | null | undefined,
  agentName: string | null | undefined,
  t: (key: string, fallback: string, options?: Record<string, string>) => string
): { title: string; body: string } {
  if (status === 'assigned_to_agent') {
    return {
      title: t('client.orderJourney.claimed.title', 'Agent on the way to the store'),
      body: agentName
        ? t('client.orderJourney.claimed.nowNamed', '{{agentName}} just claimed your order and is heading to pick it up.', { agentName })
        : t('client.orderJourney.claimed.now', 'A delivery agent claimed your order and is heading to pick it up.'),
    };
  }
  if (status === 'picked_up' || status === 'in_transit') {
    return {
      title: t('client.orderJourney.onTheWay.title', 'On the way to you'),
      body: agentName
        ? t('client.orderJourney.onTheWay.nowNamed', '{{agentName}} picked up your order and is coming to you.', { agentName })
        : t('client.orderJourney.onTheWay.now', 'Your delivery person picked up your order and is coming to you.'),
    };
  }
  if (status === 'out_for_delivery') {
    return {
      title: t('client.tracking.outForDelivery', 'Out for delivery'),
      body: agentName
        ? t('client.orderJourney.outForDelivery.nowNamed', '{{agentName}} is out for delivery and will arrive soon.', { agentName })
        : t('client.orderJourney.outForDelivery.now', 'Your order is out for delivery and will arrive soon.'),
    };
  }
  return {
    title: t('client.orderJourney.shippingInTransit.title', 'On the way'),
    body: t('client.journey.onTheWay', 'Your order is on the way.'),
  };
}

export function ClientTrackingHero({
  phase,
  status,
  fulfillment,
  agentName,
  storeName,
  storeAddress,
  onOpenMap,
  onPin,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const delivery = phase === 'in_delivery';
  const pickup = phase === 'ready' && fulfillment === 'pickup';
  if (!delivery && !pickup) return null;
  const copy = delivery
    ? deliveryCopy(status, agentName, t as (key: string, fallback: string, options?: Record<string, string>) => string)
    : null;
  return (
    <View style={{ marginBottom: spacing.md, padding: spacing.md, borderRadius: borderRadius.card, backgroundColor: colors.surface }}>
      <AppText role="h3">
        {copy ? copy.title : t('client.tracking.readyForPickup', 'Ready for pickup')}
      </AppText>
      <AppText role="body" style={{ marginTop: spacing.xs }}>
        {copy ? copy.body : [storeName, storeAddress].filter(Boolean).join('\n')}
      </AppText>
      {delivery && onOpenMap ? (
        <AppButton label={t('orders.viewMap', 'View map')} variant="outline" onPress={onOpenMap} style={{ marginTop: spacing.sm }} />
      ) : null}
      {onPin ? (
        <AppButton label={t('orders.deliveryPin', 'Delivery PIN')} variant="primary" onPress={onPin} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}
