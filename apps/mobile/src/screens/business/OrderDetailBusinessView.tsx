import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { BottomOverlaySnackbar } from '../../components/feedback/BottomOverlaySnackbar';
import { BusinessOrderItemsCard } from '../../components/business/BusinessOrderItemsCard';
import { BusinessOrderRowActions } from '../../components/business/BusinessOrderRowActions';
import { StatusPill } from '../../components/common/StatusPill';
import { SectionCard } from '../../components/common/SectionCard';
import { ContactCard } from '../../components/orders/shared/ContactCard';
import { ExpandableSection } from '../../components/common/ExpandableSection';
import { InfoRow } from '../../components/common/InfoRow';
import { OrderNowLine } from '../../components/orders/OrderActionBar';
import { ShippingTrackingCard } from '../../components/orders/ShippingTrackingCard';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessOrderDetail } from '../../hooks/business/useBusinessOrderDetail';
import type { Address } from '../../types/agent';
import { getBusinessOrderActions } from '../../utils/businessOrderActions';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import {
  businessOrderAgentLabel,
  formatOrderTimeWindowLabel,
  isStorePickupOrder,
  resolveOrderTimeWindow,
} from '../../utils/businessOrderListDisplay';
import { formatPreferredDate, formatTimeSlotValue } from '../../utils/deliveryWindowUtils';
import { isCarrierShipping } from '../../utils/fulfillmentMethod';
import { recipientContact } from '../../orders/model/helpers';
import {
  orderToPhaseInput,
  resolveOrderPhase,
} from '../../utils/orderPhase';
import { OrderClientSummaryCard } from '../shared/orderDetail/OrderClientSummaryCard';
import { orderStatusStripeColor } from '../../utils/clientOrderListDisplay';

type OrderDetailParams = {
  orderId: string;
  openMessages?: boolean;
  highlightMessageId?: string;
};

type Props = {
  route: RouteProp<{ OrderDetail: OrderDetailParams }, 'OrderDetail'> | {
    params: OrderDetailParams;
    key: string;
    name: string;
  };
  navigation: NativeStackNavigationProp<Record<string, object | undefined>>;
};

function formatAddress(addr: Address | undefined): string {
  if (!addr) return '—';
  return [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
}

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function OrderDetailBusinessView({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { mode } = useOrdersApi();
  const { order, loading, error, refetch } = useBusinessOrderDetail(orderId);
  const [snack, setSnack] = useState<string | null>(null);

  const onOrderMutated = useCallback(() => {
    void refetch();
  }, [refetch]);

  const phaseInfo = useMemo(
    () => (order ? resolveOrderPhase(orderToPhaseInput(order), 'business') : null),
    [order]
  );

  if (loading && !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: 24 }]}>
        <Text style={{ color: colors.error.main, textAlign: 'center' }}>
          {error ?? t('orders.notFound', 'Order not found')}
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  const clientName = [order.client?.user?.first_name, order.client?.user?.last_name].filter(Boolean).join(' ');
  const clientPhone = order.client?.user?.phone_number;
  const recipient = recipientContact(order);
  const agentLabel = businessOrderAgentLabel(order);
  const agentPhone = order.assigned_agent?.user?.phone_number;
  const isPickup = isStorePickupOrder(order);
  const isShipping = isCarrierShipping(order.fulfillment_method);
  const slotLabel = formatOrderTimeWindowLabel(order, locale);
  const primaryWindow = resolveOrderTimeWindow(order);
  const showStickyActions = getBusinessOrderActions(order, { mode }).length > 0;
  const status = order.current_status ?? 'unknown';
  const nowTitle = t(`common.orderStatus.${status}`, status);
  const nowSubtitle = phaseInfo?.nextStepKey
    ? t(phaseInfo.nextStepKey, '')
    : null;

  const itemsCardStyle = {
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.sm,
          paddingBottom: showStickyActions ? 120 : spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} />}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleLarge" style={{ color: colors.text.primary }} numberOfLines={1}>
              {t('orders.orderNumber', 'Order #{{orderNumber}}', {
                orderNumber: order.order_number,
              })}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {t('orders.placedOn', 'Placed on')} {formatWhen(locale, order.created_at)}
            </Text>
          </View>
          <StatusPill
            compact
            label={t(`common.orderStatus.${status}`, status)}
            backgroundColor={`${orderStatusStripeColor(status, colors)}28`}
            borderColor={`${orderStatusStripeColor(status, colors)}55`}
            textColor={colors.text.primary}
          />
        </View>

        <OrderNowLine title={nowTitle} subtitle={nowSubtitle || undefined} />

        {order.acceptance_state === 'scheduled' ? (
          <SectionCard
            title={t('business.orders.scheduled', 'Scheduled')}
            style={{ marginBottom: spacing.xs }}
          >
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {order.acceptance_activates_at
                ? t(
                    'business.orders.scheduledDetail',
                    'Confirmation timer starts at {{when}}. You can confirm early anytime.',
                    { when: formatWhen(locale, order.acceptance_activates_at) }
                  )
                : t(
                    'business.orders.scheduledEarly',
                    'This future order is waiting. You can confirm early anytime.'
                  )}
            </Text>
          </SectionCard>
        ) : null}

        <BusinessOrderItemsCard order={order} locale={locale} cardStyle={itemsCardStyle} />

        <ExpandableSection title={t('orders.detail.peopleAndPlace', 'People & place')}>
          {recipient ? (
            <View style={{ marginBottom: spacing.xs }}>
              <ContactCard
                title={t('orders.deliveryContactRecipient', 'Recipient')}
                contact={{
                  ...recipient,
                  subtitle: t('orders.recipientReceives', 'Receives this order'),
                }}
              />
            </View>
          ) : null}

          <InfoRow
            icon="account-outline"
            label={t('business.orders.detailClient', 'Customer')}
            value={clientName || '—'}
          />
          {order.client?.user?.email ? (
            <InfoRow
              icon="email-outline"
              label={t('common.email', 'Email')}
              value={order.client.user.email}
            />
          ) : null}
          {clientPhone ? (
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs }}
              onPress={() => void Linking.openURL(`tel:${clientPhone}`)}
            >
              <MaterialCommunityIcons name="phone" size={16} color={colors.primary.main} />
              <Text style={{ color: colors.primary.main }}>{clientPhone}</Text>
            </Pressable>
          ) : null}

          <InfoRow
            icon="store-outline"
            label={t('business.orders.card.pickupLocation', 'Pickup')}
            value={
              [order.business_location?.name, formatAddress(order.business_location?.address)]
                .filter(Boolean)
                .join(' · ') || '—'
            }
            vertical
          />
          {!isPickup ? (
            <InfoRow
              icon="map-marker-outline"
              label={
                isShipping
                  ? t('orders.shipping.shipTo', 'Ship to')
                  : t('orders.deliveryAddressLabel', 'Delivery address')
              }
              value={formatAddress(order.delivery_address) || '—'}
              vertical
            />
          ) : null}

          {primaryWindow || slotLabel ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: 4 }}>
                {isPickup
                  ? t('business.orders.detailPickupSlot', 'Pickup slot')
                  : t('business.orders.detailDeliveryWindows', 'Delivery windows')}
              </Text>
              {(isPickup && primaryWindow ? [primaryWindow] : order.delivery_time_windows ?? []).map(
                (w) => (
                  <View key={w.id} style={{ marginBottom: spacing.sm }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                      {w.preferred_date ? formatPreferredDate(w.preferred_date, locale) : '—'}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
                      {w.time_slot_start && w.time_slot_end
                        ? `${formatTimeSlotValue(w.time_slot_start, locale)} – ${formatTimeSlotValue(w.time_slot_end, locale)}`
                        : ''}
                      {w.slot?.slot_name ? ` · ${w.slot.slot_name}` : ''}
                    </Text>
                  </View>
                )
              )}
            </View>
          ) : null}

          {isShipping ? (
            <ShippingTrackingCard
              carrier={order.shipping_carrier}
              trackingNumber={order.shipping_tracking_number}
              shippedAt={order.shipped_at}
            />
          ) : null}

          {!isPickup && !isShipping ? (
            <InfoRow
              icon="account-tie-outline"
              label={t('business.orders.card.agent', 'Agent')}
              value={agentLabel ?? t('business.orders.card.unassignedAgent', 'Not assigned yet')}
            />
          ) : null}
          {agentPhone ? (
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs }}
              onPress={() => void Linking.openURL(`tel:${agentPhone}`)}
            >
              <MaterialCommunityIcons name="phone" size={16} color={colors.primary.main} />
              <Text style={{ color: colors.primary.main }}>{agentPhone}</Text>
            </Pressable>
          ) : null}
        </ExpandableSection>

        <ExpandableSection title={t('orders.detail.money', 'Money')}>
          <OrderClientSummaryCard
            order={order}
            locale={locale}
            onRefetch={() => void refetch()}
            onNotify={(msg) => setSnack(msg)}
            hidePaymentActions
          />
        </ExpandableSection>
      </ScrollView>

      {showStickyActions ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.xs,
            paddingBottom: insets.bottom + spacing.sm,
          }}
        >
          <BusinessOrderRowActions order={order} onSuccess={onOrderMutated} />
        </View>
      ) : null}

      <BottomOverlaySnackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </BottomOverlaySnackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
