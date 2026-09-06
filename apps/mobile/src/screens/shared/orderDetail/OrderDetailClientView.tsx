import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Divider,
  IconButton,
  Snackbar,
  Text,
} from 'react-native-paper';
import { AgentLocationMapModal } from '../../../components/client/AgentLocationMapModal';
import { CancellationConfirmSheet } from '../../../components/client/CancellationConfirmSheet';
import { ClientPickupPaymentSheet } from '../../../components/client/ClientPickupPaymentSheet';
import { NoAgentOptionsSheet } from '../../../components/client/NoAgentOptionsSheet';
import { SendDeliveryPinButton } from '../../../components/client/SendDeliveryPinButton';
import { StatusPill } from '../../../components/common/StatusPill';
import { SectionCard } from '../../../components/common/SectionCard';
import { InfoRow } from '../../../components/common/InfoRow';
import { RateOrderModal, type RateOrderMode } from '../../../components/dialogs/RateOrderModal';
import { OrderPhaseBanner } from '../../../components/orders/OrderPhaseBanner';
import { FirstOrderJourneyCard } from '../../../components/client/FirstOrderJourneyCard';
import { ShippingTrackingCard } from '../../../components/orders/ShippingTrackingCard';
import { ContactCard } from '../../../components/orders/shared/ContactCard';
import { OrderBusyDemandBanner } from '../../../components/client/OrderBusyDemandBanner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useMainTabContentBottomPadding } from '../../../hooks/useMainTabContentBottomPadding';
import { useOrderDetail } from '../../../hooks/useOrderDetail';
import { useClientOrders } from '../../../hooks/useClientOrders';
import { useFirstOrderClientJourney } from '../../../hooks/client/useFirstOrderClientJourney';
import { useOrderRatingEligibility } from '../../../hooks/useOrderRatingEligibility';
import { agentApi } from '../../../services/agentApi';
import type { Address, Order, OrderItem } from '../../../types/agent';
import { clientCanCancelOrder, clientShowAgentLocation, clientShowDeliveryPin, clientShowNoAgentOptions } from '../../../utils/clientOrderActions';
import { getClientOrderJourney } from '../../../utils/clientOrderJourney';
import { trackCancellationEvent } from '../../../utils/cancellationAnalytics';
import {
  orderItemImageUrl,
  orderStatusStripeColor,
} from '../../../utils/clientOrderListDisplay';
import {
  formatOrderTimeWindowLabel,
  isStorePickupOrder,
  resolveOrderTimeWindow,
} from '../../../utils/businessOrderListDisplay';
import { formatPreferredDate, formatTimeSlotValue } from '../../../utils/deliveryWindowUtils';
import { formatCurrency } from '../../../utils/formatters';
import { isCarrierShipping } from '../../../utils/fulfillmentMethod';
import {
  ORDER_PRIMARY_ACTION_LABEL,
  orderToPhaseInput,
  resolveOrderPhase,
} from '../../../utils/orderPhase';
import { OrderClientSummaryCard } from './OrderClientSummaryCard';
import { ClientOrderJourneyCard } from '../../../components/client/ClientOrderJourneyCard';
import {
  buildClientOrderViewModel,
  type ClientOrderViewModel,
  type OrderViewModelContext,
} from '../../../orders/model';
import type { OrderDetailScreenProps } from './types';

type Props = OrderDetailScreenProps;

const SECTION_GAP = 12;

function formatAddress(addr: Address | undefined): string {
  if (!addr) return '';
  return [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
}

/** One address field per line so store pickup details stay fully readable. */
function formatAddressMultiline(addr: Address | undefined): string {
  if (!addr) return '';
  return [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function itemLabel(item: OrderItem): string {
  const name = item.item?.name ?? item.item_name ?? '—';
  const variant = item.variant_name?.trim();
  return variant ? `${name} · ${variant}` : name;
}

function isTerminalClientOrder(status: string) {
  return ['cancelled', 'failed', 'refunded'].includes(status);
}

function ClientOrderHeroCard({
  order,
  locale,
  status,
  vm,
  onRefetch,
}: {
  order: Order;
  locale: string;
  status: string;
  vm: ClientOrderViewModel | null;
  onRefetch: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const isPickup = isStorePickupOrder(order);

  const shell = useMemo(
    () => ({
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      marginBottom: SECTION_GAP,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
    }),
    [borderRadius.md, colors.surface, colors.divider, spacing.sm]
  );

  return (
    <View style={shell}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleLarge" numberOfLines={1} style={{ color: colors.primary.main, flex: 1, marginRight: spacing.xs }}>
          #{order.order_number}
        </Text>
        <IconButton
          icon="refresh"
          mode="contained-tonal"
          size={20}
          onPress={() => void onRefetch()}
          accessibilityLabel={t('common.refresh', 'Refresh')}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: spacing.xs,
          rowGap: 4,
          marginTop: spacing.xxs,
        }}
      >
        <StatusPill
          compact
          label={
            isPickup
              ? t('orders.pickupSection', 'Store pickup')
              : t('orders.deliveryLabel', 'Delivery')
          }
          backgroundColor={colors.primaryTint}
          borderColor={`${colors.primary.main}44`}
          textColor={colors.primary.main}
        />
        <StatusPill
          compact
          label={vm?.statusMessage ?? t(`common.orderStatus.${status}`, status)}
          backgroundColor={`${orderStatusStripeColor(status, colors)}28`}
          borderColor={`${orderStatusStripeColor(status, colors)}55`}
          textColor={colors.text.primary}
        />
      </View>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: spacing.xxs }}
        numberOfLines={2}
      >
        {t('orders.clientManage.placedShort', 'Placed')}{' '}
        {formatWhen(locale, order.created_at)}
      </Text>

      {vm?.heroTitle ? (
        <Text variant="titleMedium" style={{ fontWeight: '700', marginTop: spacing.sm, color: colors.text.primary }}>
          {vm.heroTitle}
        </Text>
      ) : null}
      {vm?.etaText ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs }}>
          {vm.etaText}
        </Text>
      ) : null}
      {vm?.nextStepMessage ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs }}>
          {vm.nextStepMessage}
        </Text>
      ) : null}

      {isTerminalClientOrder(status) && !vm?.heroTitle ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {t(`common.orderStatus.${status}`, status)}
        </Text>
      ) : null}
    </View>
  );
}

export default function OrderDetailClientView({ route, navigation }: Props) {
  const { orderId, rate: rateIntent } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = useMainTabContentBottomPadding(24);
  const { order, loading, error, refetch } = useOrderDetail(orderId);
  const { orders, loading: ordersLoading, error: ordersError } = useClientOrders(true);
  const firstOrderJourney = useFirstOrderClientJourney({
    order,
    clientOrders: ordersLoading || ordersError ? null : orders,
  });

  const [mapOpen, setMapOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noAgentOpen, setNoAgentOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [rateMode, setRateMode] = useState<RateOrderMode | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [payPickupOpen, setPayPickupOpen] = useState(false);
  const [payPickupLoading, setPayPickupLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const paymentSectionY = useRef(0);
  // Keyed by order + intent so a new deep link (same mounted screen, different
  // order or rate param) auto-opens again instead of being swallowed.
  const consumedRateIntentKey = useRef<string | null>(null);
  // Keyed by order + exhaustion timestamp so re-exhaustion after a later retry
  // auto-opens again, but dismissing once doesn't re-trigger for the same event.
  const consumedNoAgentKey = useRef<string | null>(null);

  const { eligibility, refetch: refetchEligibility } = useOrderRatingEligibility(
    orderId,
    order?.current_status === 'complete'
  );

  const clientVm = useMemo(() => {
    if (!order) return null;
    const ctx: OrderViewModelContext = {
      t: (key, defaultValue, options) =>
        String(t(key, { defaultValue: defaultValue ?? key, ...(options ?? {}) })),
      now: new Date(),
      locale: i18n.language,
    };
    return buildClientOrderViewModel(order, ctx);
  }, [order, t, i18n.language]);

  // Close any rating sheet left over from a previously viewed order.
  useEffect(() => {
    setRateMode(null);
  }, [orderId]);

  // Auto-open the "no agent found" fallback sheet as soon as the order data
  // shows dispatch was exhausted (covers both direct visits and notification
  // deep links, since DELIVERY_NO_AGENT routes generically to this screen).
  useEffect(() => {
    if (!order || !clientShowNoAgentOptions(order)) return;
    const key = `${orderId}:${order.dispatch_exhausted_at}`;
    if (consumedNoAgentKey.current === key) return;
    consumedNoAgentKey.current = key;
    setNoAgentOpen(true);
  }, [orderId, order]);

  // Auto-open the rating sheet from a push deep link (rate=agent|item).
  // Only mark the intent consumed when the sheet actually opens, so a later
  // eligibility refresh can still honor it.
  useEffect(() => {
    if (!rateIntent || !eligibility) return;
    const key = `${orderId}:${rateIntent}`;
    if (consumedRateIntentKey.current === key) return;
    if (
      (rateIntent === 'agent' && eligibility.canRateAgent) ||
      (rateIntent === 'item' && eligibility.canRateItem)
    ) {
      consumedRateIntentKey.current = key;
      setRateMode(rateIntent);
    }
  }, [orderId, rateIntent, eligibility]);

  const onPinSent = useCallback(() => {
    setSnack(t('orders.messaging.deliveryPin.sendSuccess', 'PIN sent in order messages'));
  }, [t]);

  const onPinError = useCallback((message: string) => {
    setSnack(message);
  }, []);

  if (loading && !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('common.loading', 'Loading...')}</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: 24 }]}>
        <Text style={{ color: colors.error.main, textAlign: 'center' }}>{error || t('orders.notFound', 'Order not found')}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  const status = order.current_status ?? 'unknown';
  const isPickup = isStorePickupOrder(order);
  const slotWindow = resolveOrderTimeWindow(order);
  const slotLabel = formatOrderTimeWindowLabel(order, locale);
  const phaseInfo = resolveOrderPhase(orderToPhaseInput(order), 'client');
  const primaryActionId = phaseInfo.primaryActionId;
  const canShowRatePrimary = !!(
    eligibility?.canRateAgent || eligibility?.canRateItem
  );
  const stickyPrimaryId =
    primaryActionId === 'rate' && !canShowRatePrimary ? 'none' : primaryActionId;
  const showStickyPrimary = [
    'pay',
    'send_pin',
    'rate',
    'complete',
    'confirm_receipt',
  ].includes(stickyPrimaryId);
  const [primaryLabelKey, primaryLabelDefault] =
    stickyPrimaryId === 'pay' && order.payment_timing === 'pay_at_pickup'
      ? (['orders.payAtPickup.cta', 'Pay now'] as const)
      : ORDER_PRIMARY_ACTION_LABEL[stickyPrimaryId];
  const showCancel = clientCanCancelOrder(order);
  const showNoAgentOptions = clientShowNoAgentOptions(order);
  const scrollPad = {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: showStickyPrimary || showCancel ? 120 : tabPad,
  };
  const cur = order.currency || 'XAF';
  const showPin = clientShowDeliveryPin(order);
  const showMap = clientShowAgentLocation(status, order.fulfillment_method);
  const isShipping = isCarrierShipping(order.fulfillment_method);
  const journey = getClientOrderJourney(order);
  const pinInJourney = showPin && journey.emphasizePinCta;
  const showPinInActions = showPin && !pinInJourney;
  const itemRatingLocked =
    !!eligibility &&
    !eligibility.canRateItem &&
    !!eligibility.itemRatingUnlocksAt &&
    new Date(eligibility.itemRatingUnlocksAt) > new Date() &&
    eligibility.items.some((i) => !i.rated);

  const runCompleteOrder = async () => {
    setActionLoading(true);
    try {
      await agentApi.orders.complete({ orderId });
      setSnack(t('messages.orderCompleteSuccess', 'Order completed successfully'));
      void refetch();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('messages.orderCompleteError', 'Failed to complete order')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const runConfirmReceipt = async () => {
    setActionLoading(true);
    try {
      await agentApi.orders.confirmReceipt(orderId);
      setSnack(t('orders.shipping.receiptSuccess', 'Thanks — your order is complete.'));
      void refetch();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('orders.shipping.receiptFailed', 'Failed to confirm receipt')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const runPayAtPickup = async (phoneNumber?: string) => {
    setPayPickupLoading(true);
    try {
      await agentApi.orders.initiatePayAtPickupPayment(orderId, phoneNumber);
      setPayPickupOpen(false);
      const phoneE164 =
        phoneNumber?.trim() ||
        order?.client?.user?.phone_number?.trim() ||
        '';
      navigation.navigate('MobileMoneyAwaitingPayment', {
        orderIds: [orderId],
        phoneE164,
        source: 'pickup',
        orderNumbers: order?.order_number ? [order.order_number] : undefined,
      });
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('orders.payAtPickup.error', 'Failed to start payment')
      );
    } finally {
      setPayPickupLoading(false);
    }
  };

  const onStickyPrimaryPress = () => {
    if (stickyPrimaryId === 'pay') {
      if (order.payment_timing === 'pay_at_pickup') {
        setPayPickupOpen(true);
        return;
      }
      scrollRef.current?.scrollTo({ y: paymentSectionY.current, animated: true });
      return;
    }
    if (stickyPrimaryId === 'rate') {
      const mode = eligibility?.canRateAgent
        ? 'agent'
        : eligibility?.canRateItem
          ? 'item'
          : null;
      if (mode) setRateMode(mode);
      return;
    }
    if (stickyPrimaryId === 'confirm_receipt') {
      void runConfirmReceipt();
      return;
    }
    if (stickyPrimaryId === 'complete') void runCompleteOrder();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView ref={scrollRef} contentContainerStyle={scrollPad} showsVerticalScrollIndicator={false}>

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        <ClientOrderHeroCard
          order={order}
          locale={locale}
          status={status}
          vm={clientVm}
          onRefetch={() => void refetch()}
        />

        {firstOrderJourney ? (
          <FirstOrderJourneyCard
            journey={firstOrderJourney}
            storeAddress={order.business_location?.address}
            storeName={order.business_location?.name}
          />
        ) : (
          <OrderPhaseBanner order={order} role="client" />
        )}

        {showNoAgentOptions ? (
          <View style={{ marginBottom: SECTION_GAP }}>
            <View
              style={{
                backgroundColor: colors.warning.main + '15',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text variant="titleSmall" style={{ color: colors.warning.dark }}>
                {t('orders.noAgent.bannerTitle', "We couldn't find a nearby courier")}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t(
                  'orders.noAgent.bannerBody',
                  'Switch to store pickup (fee waived) or cancel the order.'
                )}
              </Text>
              <Button mode="contained-tonal" onPress={() => setNoAgentOpen(true)}>
                {t('orders.noAgent.viewOptions', 'View options')}
              </Button>
            </View>
          </View>
        ) : null}

        {order.current_status === 'pending' &&
        (order.busy_extra_prep_minutes ?? 0) > 0 &&
        order.estimated_prep_minutes ? (
          <View style={{ marginBottom: SECTION_GAP }}>
            <OrderBusyDemandBanner
              estimatedPrepMinutes={order.estimated_prep_minutes}
              showActions={false}
            />
          </View>
        ) : null}

        {firstOrderJourney ? null : (
          <View style={{ marginBottom: SECTION_GAP }}>
            <ClientOrderJourneyCard
              order={order}
              variant="full"
              showPinAction={false}
              onPinSent={onPinSent}
              onPinError={onPinError}
            />
          </View>
        )}

        {isShipping ? (
          <ShippingTrackingCard
            carrier={order.shipping_carrier}
            trackingNumber={order.shipping_tracking_number}
            shippedAt={order.shipped_at}
          />
        ) : null}

        {/* ── Rating CTAs (eligibility-driven) ─────────────────────────── */}
        {eligibility &&
        (eligibility.canRateAgent || eligibility.canRateItem || itemRatingLocked) ? (
          <SectionCard title={t('rating.sectionTitle', 'Rate this order')} style={styles.section}>
            <View style={styles.actionsRow}>
              {eligibility.canRateAgent ? (
                <Button
                  mode="contained"
                  icon="star"
                  onPress={() => setRateMode('agent')}
                  style={styles.actionBtn}
                  contentStyle={styles.actionBtnContent}
                >
                  {t('rating.rateAgentCta', 'Rate delivery agent')}
                </Button>
              ) : null}
              {eligibility.canRateItem ? (
                <Button
                  mode="contained"
                  icon="star"
                  onPress={() => setRateMode('item')}
                  style={styles.actionBtn}
                  contentStyle={styles.actionBtnContent}
                >
                  {t('rating.rateItemsCta', 'Rate your items')}
                </Button>
              ) : null}
            </View>
            {itemRatingLocked && eligibility.itemRatingUnlocksAt ? (
              <Text
                variant="bodySmall"
                style={{ color: colors.text.secondary, marginTop: spacing.xs }}
              >
                {t('rating.itemRatingUnlocksOn', 'You can rate your items from {{date}}', {
                  date: new Date(eligibility.itemRatingUnlocksAt).toLocaleDateString(locale),
                })}
              </Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Actions (prominent primary actions) ──────────────────────── */}
        {(showPinInActions || showMap) ? (
          <SectionCard title={t('orders.clientManage.actionsTitle', 'Actions')} style={styles.section}>
            <View style={styles.actionsRow}>
              {showMap ? (
                <Button mode="contained" icon="map" onPress={() => setMapOpen(true)} style={styles.actionBtn} contentStyle={styles.actionBtnContent}>
                  {t('orders.viewOnMap', 'View agent on map')}
                </Button>
              ) : null}
              {showPinInActions ? (
                <View style={styles.actionBtn}>
                  <SendDeliveryPinButton
                    orderId={orderId}
                    pinAudience={isStorePickupOrder(order) ? 'business' : 'agent'}
                    onSent={onPinSent}
                    onError={onPinError}
                  />
                </View>
              ) : null}
            </View>
          </SectionCard>
        ) : null}

        {/* ── Payment summary ───────────────────────────────────────────── */}
        <View onLayout={(event) => { paymentSectionY.current = event.nativeEvent.layout.y; }}>
          <OrderClientSummaryCard
            order={order}
            locale={locale}
            cardStyle={styles.section}
            onRefetch={() => void refetch()}
            onNotify={(msg) => setSnack(msg)}
            onAwaitingPayment={(params) =>
              navigation.navigate('MobileMoneyAwaitingPayment', params)
            }
          />
        </View>

        {/* ── Items ────────────────────────────────────────────────────── */}
        <SectionCard title={t('orders.orderItems', 'Items')} style={styles.section}>
          {(order.order_items ?? []).map((oi, idx) => {
            const imageUri = orderItemImageUrl(oi);
            return (
              <View key={oi.id}>
                {idx > 0 ? <Divider style={{ marginVertical: spacing.xs }} /> : null}
                <View style={styles.itemRow}>
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={[styles.itemThumb, { backgroundColor: colors.pageBackground }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.itemThumb, styles.itemThumbFallback, { backgroundColor: colors.pageBackground, borderColor: colors.divider }]}>
                      <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.text.secondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyLarge" numberOfLines={2}>
                      {itemLabel(oi)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
                      {t('orders.quantity', 'Qty')}: {oi.quantity}
                      {oi.total_price != null ? ` · ${formatCurrency(oi.total_price, cur, locale)}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
          {order.special_instructions ? (
            <>
              <Divider style={{ marginVertical: spacing.xs }} />
              <InfoRow
                icon="note-outline"
                label={t('orders.specialInstructions', 'Special instructions')}
                value={order.special_instructions}
                vertical
              />
            </>
          ) : null}
        </SectionCard>

        {/* ── Delivery / Pickup ─────────────────────────────────────────── */}
        <SectionCard
          title={
            isPickup
              ? t('orders.pickupSection', 'Store pickup')
              : t('orders.deliveryLabel', 'Delivery')
          }
          style={styles.section}
        >
          <InfoRow
            icon="storefront-outline"
            label={
              isPickup
                ? t('orders.pickupLabel', 'Pick up from')
                : t('orders.merchantLocationLabel', 'From store')
            }
            value={order.business_location?.name ?? '—'}
            vertical
            truncate={false}
          />
          {formatAddressMultiline(order.business_location?.address) ? (
            <InfoRow
              icon="map-marker-outline"
              label={
                isPickup
                  ? t('orders.pickupAddressLabel', 'Store address')
                  : t('orders.merchantAddressLabel', 'Store address')
              }
              value={formatAddressMultiline(order.business_location?.address)}
              vertical
              truncate={false}
            />
          ) : null}
          {isPickup && clientVm?.contacts.business ? (
            <>
              <Divider style={{ marginVertical: spacing.xs }} />
              <ContactCard
                title={t('orders.contact.store', 'Store contact')}
                contact={clientVm.contacts.business}
              />
            </>
          ) : null}
          {!isPickup ? (
            <>
              <Divider style={{ marginVertical: spacing.xs }} />
              <InfoRow
                icon="map-marker-outline"
                label={t('orders.deliveryAddressLabel', 'Deliver to')}
                value={formatAddress(order.delivery_address) || '—'}
                vertical
                truncate={false}
              />
            </>
          ) : null}
          {slotWindow || slotLabel || (order.delivery_time_windows?.length ?? 0) > 0 ? (
            <>
              <Divider style={{ marginVertical: spacing.xs }} />
              <Text style={[styles.subLabel, { color: colors.text.secondary }]}>
                {isPickup
                  ? t('orders.clientManage.pickupSlot', 'Pickup slot')
                  : t('orders.clientManage.whenAvailable', 'Scheduled window')}
              </Text>
              {(isPickup && slotWindow
                ? [slotWindow]
                : order.delivery_time_windows?.length
                  ? order.delivery_time_windows
                  : slotWindow
                    ? [slotWindow]
                    : []
              ).map((w) => (
                <Text key={w.id} variant="bodyMedium" style={{ marginTop: 2 }}>
                  {w.preferred_date ? formatPreferredDate(w.preferred_date, locale) : ''}
                  {w.time_slot_start && w.time_slot_end
                    ? ` · ${formatTimeSlotValue(w.time_slot_start, locale)} – ${formatTimeSlotValue(w.time_slot_end, locale)}`
                    : ''}
                  {w.slot?.slot_name ? ` (${w.slot.slot_name})` : ''}
                </Text>
              ))}
              {!order.delivery_time_windows?.length && !slotWindow && slotLabel ? (
                <Text variant="bodyMedium" style={{ marginTop: 2 }}>
                  {slotLabel}
                </Text>
              ) : null}
            </>
          ) : null}
        </SectionCard>

      </ScrollView>

      {showStickyPrimary || showCancel ? (
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          }}
        >
          {stickyPrimaryId === 'send_pin' ? (
            <SendDeliveryPinButton
              orderId={orderId}
              pinAudience={isStorePickupOrder(order) ? 'business' : 'agent'}
              onSent={onPinSent}
              onError={onPinError}
            />
          ) : showStickyPrimary ? (
            <Button
              mode="contained"
              loading={actionLoading}
              onPress={onStickyPrimaryPress}
            >
              {t(primaryLabelKey, primaryLabelDefault)}
            </Button>
          ) : null}
          {showCancel ? (
          <Button
            mode="outlined"
            textColor={colors.error.main}
            icon="close-circle-outline"
            onPress={() => {
              setCancelOpen(true);
              trackCancellationEvent('cancellation_dialog_opened', {
                orderId: order.id,
                orderStatus: status,
                paymentSource: (order as any).payment_source ?? '',
              });
            }}
          >
            {t('orderActions.cancelOrder', 'Cancel order')}
          </Button>
          ) : null}
        </View>
      ) : null}

      <AgentLocationMapModal visible={mapOpen} orderId={orderId} onDismiss={() => setMapOpen(false)} />
      <ClientPickupPaymentSheet
        visible={payPickupOpen}
        order={order}
        loading={payPickupLoading}
        onDismiss={() => setPayPickupOpen(false)}
        onSubmit={runPayAtPickup}
      />
      <CancellationConfirmSheet
        visible={cancelOpen}
        order={order}
        onDismiss={() => setCancelOpen(false)}
        onSuccess={() => {
          setCancelOpen(false);
          setSnack(t('orderActions.cancelSuccess', 'Order cancelled successfully.'));
          void refetch();
        }}
      />
      <NoAgentOptionsSheet
        visible={noAgentOpen}
        order={order}
        onDismiss={() => setNoAgentOpen(false)}
        onSwitchedToPickup={() => {
          setNoAgentOpen(false);
          setSnack(
            t(
              'orders.noAgent.switchedSuccess',
              'Switched to store pickup. The delivery fee has been waived.'
            )
          );
          void refetch();
        }}
        onCancelInstead={() => {
          setNoAgentOpen(false);
          setCancelOpen(true);
        }}
      />
      <RateOrderModal
        visible={rateMode !== null}
        mode={rateMode ?? 'agent'}
        orderId={orderId}
        orderNumber={order.order_number ?? ''}
        eligibility={eligibility}
        onClose={() => setRateMode(null)}
        onSubmitted={() => {
          setSnack(t('rating.submitted', 'Thanks for your rating!'));
          void refetchEligibility();
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: SECTION_GAP },
  actionsRow: { flexDirection: 'column', gap: 8 },
  actionBtn: { borderRadius: 16 },
  actionBtnContent: { height: 48 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  itemThumb: { width: 52, height: 52, borderRadius: 10 },
  itemThumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  subLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
});
