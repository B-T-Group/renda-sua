import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Button,
  Divider,
  IconButton,
  Snackbar,
  Text,
} from 'react-native-paper';
import { AgentLocationMapModal } from '../../../components/client/AgentLocationMapModal';
import { CancellationConfirmSheet } from '../../../components/client/CancellationConfirmSheet';
import { ForfeitDepositCancelDialog } from '../../../components/dialogs/ForfeitDepositCancelDialog';
import { ClientPickupPaymentSheet } from '../../../components/client/ClientPickupPaymentSheet';
import { NoAgentOptionsSheet } from '../../../components/client/NoAgentOptionsSheet';
import { SendDeliveryPinButton } from '../../../components/client/SendDeliveryPinButton';
import { navigateToDeliveryConfirm } from '../../../navigation/rootNavigationRef';
import { ReportDeliveryProblemDialog } from '../../../components/dialogs/ReportDeliveryProblemDialog';
import { StatusPill } from '../../../components/common/StatusPill';
import { ExpandableSection } from '../../../components/common/ExpandableSection';
import { InfoRow } from '../../../components/common/InfoRow';
import { RateOrderModal, type RateOrderMode } from '../../../components/dialogs/RateOrderModal';
import { ClientTrackingHero } from '../../../components/client/ClientTrackingHero';
import { ClientRefundRequestButton } from '../../../components/client/ClientRefundRequestButton';
import { ShippingTrackingCard } from '../../../components/orders/ShippingTrackingCard';
import { ContactCard } from '../../../components/orders/shared/ContactCard';
import { OrderBusyDemandBanner } from '../../../components/client/OrderBusyDemandBanner';
import {
  OrderActionBar,
  OrderExceptionLine,
  OrderNowLine,
} from '../../../components/orders/OrderActionBar';
import { useTheme } from '../../../contexts/ThemeContext';
import { useMainTabContentBottomPadding } from '../../../hooks/useMainTabContentBottomPadding';
import { useOrderDetail } from '../../../hooks/useOrderDetail';
import { useOrderRatingEligibility } from '../../../hooks/useOrderRatingEligibility';
import { useCancellationPreview } from '../../../hooks/useCancellationPreview';
import { agentApi } from '../../../services/agentApi';
import type { Address, Order, OrderItem } from '../../../types/agent';
import {
  clientCanCancelOrder,
  clientShowAgentLocation,
  clientShowNoAgentOptions,
} from '../../../utils/clientOrderActions';
import { useDeliveryConfirmation } from '../../../hooks/useDeliveryConfirmation';
import { resolveUsesLegacyPin } from '../../../utils/deliveryConfirmationUi';
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
import { rankClientOrderDetailActions } from '../../../utils/rankClientOrderDetailActions';
import { OrderClientSummaryCard } from './OrderClientSummaryCard';
import { EatInUnavailableNotice } from '../../../components/orders/EatInUnavailableNotice';
import {
  buildClientOrderViewModel,
  type ClientOrderViewModel,
  type OrderViewModelContext,
} from '../../../orders/model';
import type { OrderDetailScreenProps } from './types';
import {
  hasLivePendingDepositTx,
  isDepositPending,
  remainingAfterDeposit,
} from '../../../utils/depositResume';
import { leaveClientOrderDetail } from '../../../utils/clientOrderDetailBack';
import { useClientReorderFlow } from '../../../hooks/useClientReorderFlow';
import { ReorderCartConflictSheet } from '../../../components/orders/ReorderCartConflictSheet';

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

    </View>
  );
}

export default function OrderDetailClientView({ route, navigation }: Props) {
  const { orderId, rate: rateIntent } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { colors, spacing } = useTheme();
  const tabPad = useMainTabContentBottomPadding(24);
  const { order, loading, error, refetch } = useOrderDetail(orderId);
  const { state: confirmState, refetch: refetchConfirm } = useDeliveryConfirmation(
    orderId,
    order?.current_status,
    order?.fulfillment_method
  );
  const usesLegacyPin = resolveUsesLegacyPin(confirmState);
  const [problemOpen, setProblemOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [forfeitCancelOpen, setForfeitCancelOpen] = useState(false);
  const [cancellingForfeit, setCancellingForfeit] = useState(false);
  
  // For forfeit cancel: fetch cancellation preview to get valid reason IDs
  const { preview: forfeitPreview } = useCancellationPreview(
    forfeitCancelOpen ? orderId : null
  );
  const [noAgentOpen, setNoAgentOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [rateMode, setRateMode] = useState<RateOrderMode | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [payPickupOpen, setPayPickupOpen] = useState(false);
  const [payPickupLoading, setPayPickupLoading] = useState(false);
  const [payDepositLoading, setPayDepositLoading] = useState(false);
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

  const reorderFlow = useClientReorderFlow(orderId, order?.current_status);

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
        <Button
          mode="contained"
          onPress={() =>
            leaveClientOrderDetail(navigation, route.params.backTo)
          }
          style={{ marginTop: 16 }}
        >
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  const status = order.current_status ?? 'unknown';
  const isPickup = isStorePickupOrder(order);
  const slotWindow = resolveOrderTimeWindow(order);
  const slotLabel = formatOrderTimeWindowLabel(order, locale);
  const phaseInfo = resolveOrderPhase(
    orderToPhaseInput(order, { usesLegacyPin }),
    'client'
  );
  const canShowRatePrimary = !!(
    eligibility?.canRateAgent || eligibility?.canRateItem
  );
  const depositIsPending = isDepositPending(order);
  const ranked = rankClientOrderDetailActions(order, {
    canRate: canShowRatePrimary,
    reorderEnabled: reorderFlow.enabled,
    confirmReceiptOnCard: false,
    usesLegacyPin,
  });
  const stickyPrimaryId = ranked.primary?.id ?? 'none';
  const showStickyBar =
    !!ranked.primary || !!ranked.companion || ranked.overflow.length > 0;

  let primaryLabel: string | undefined;
  if (stickyPrimaryId === 'pay') {
    if (depositIsPending) {
      primaryLabel = t('deposit.payDepositCta', 'Pay deposit · {{amount}} {{currency}}', {
        amount: order.deposit_amount ?? 0,
        currency: order.currency || 'XAF',
      });
    } else if (
      order.payment_timing === 'pay_at_pickup' &&
      (order.deposit_amount ?? 0) > 0 &&
      order.deposit_status === 'paid'
    ) {
      primaryLabel = t('orders.payAtPickup.ctaAmount', 'Pay now · {{amount}} {{currency}}', {
        amount: remainingAfterDeposit(order),
        currency: order.currency || 'XAF',
      });
    } else if (ORDER_PRIMARY_ACTION_LABEL.pay) {
      const [key, fallback] = ORDER_PRIMARY_ACTION_LABEL.pay;
      primaryLabel = t(key, fallback);
    }
  }

  const showCancel = clientCanCancelOrder(order);
  const showNoAgentOptions = clientShowNoAgentOptions(order);
  const isForfeitRiskState =
    order.current_status === 'out_for_delivery' ||
    order.current_status === 'ready_for_pickup';
  const depositAmount = order.deposit_amount ?? null;
  const showForfeitDialog =
    showCancel && isForfeitRiskState && depositAmount != null && depositAmount > 0;

  const scrollPad = {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: showStickyBar ? 140 : tabPad,
  };
  const cur = order.currency || 'XAF';
  const showMap = clientShowAgentLocation(status, order.fulfillment_method);
  const isShipping = isCarrierShipping(order.fulfillment_method);
  const nowSubtitle =
    clientVm?.nextStepMessage ||
    (phaseInfo.nextStepKey ? t(phaseInfo.nextStepKey, '') : null);
  const nowTitle =
    clientVm?.heroTitle ?? t(`common.orderStatus.${status}`, status);
  const orderNowSubtitle =
    [nowSubtitle, clientVm?.etaText].filter(Boolean).join('\n') || undefined;
  const showTrackingHero =
    phaseInfo.phase === 'in_delivery' || showMap;

  const runCompleteOrder = async () => {
    setActionLoading(true);
    try {
      if (
        status === 'ready_for_pickup' &&
        resolveOrderPhase(orderToPhaseInput(order), 'client').primaryActionId ===
          'complete'
      ) {
        await agentApi.orders.completePickup(orderId);
      } else {
        await agentApi.orders.complete({ orderId });
      }
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
      setSnack(t('orders.clientConfirm.confirmDone', 'Thanks! Your order is complete.'));
      void refetch();
      void refetchConfirm();
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

  const runReportProblem = async (description: string) => {
    setActionLoading(true);
    try {
      await agentApi.orders.reportDeliveryProblem(orderId, description);
      setProblemOpen(false);
      setSnack(t('orders.clientConfirm.problemSubmitted', 'We opened a support case.'));
      void refetch();
      void refetchConfirm();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('common.genericError', 'Something went wrong.')
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
        isDepositOrder: false,
        amountDue: remainingAfterDeposit(order),
        currency: order?.currency || 'XAF',
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

  const runPayDeposit = async (phoneNumber?: string) => {
    if (!order) return;
    setPayDepositLoading(true);
    
    const phoneE164 =
      phoneNumber?.trim() ||
      order.client?.user?.phone_number?.trim() ||
      '';
    const depositAmount = order.deposit_amount ?? 0;
    const amountDue = remainingAfterDeposit(order);
    
    // Poll-only path: if live pending deposit tx exists, navigate directly to await (no POST)
    // Per PE: prefer poll when deposit_mobile_payment_transaction_id is set AND deposit pending
    if (hasLivePendingDepositTx(order)) {
      navigation.navigate('MobileMoneyAwaitingPayment', {
        orderIds: [orderId],
        phoneE164,
        source: 'order-detail',
        orderNumbers: order.order_number ? [order.order_number] : undefined,
        isDepositOrder: true,
        depositAmount,
        amountDue,
        currency: order.currency,
      });
      setPayDepositLoading(false);
      return;
    }
    
    // Retry path: no live pending attempt → POST retry-deposit-payment
    try {
      const response = await agentApi.orders.retryDepositPayment(
        orderId,
        phoneNumber?.trim() ? { phone_number: phoneNumber.trim() } : {}
      );
      
      // Handle 200 with deposit_status "paid": already paid, refresh order
      if (response.deposit_status === 'paid') {
        setSnack(
          response.message ||
          t('deposit.alreadyPaid', 'Deposit is already paid')
        );
        void refetch();
        return;
      }
      
      // Handle 200 with new transaction: navigate to await screen
      if (!response.success) {
        throw new Error(response.message || 'Failed to initiate deposit payment');
      }
      
      navigation.navigate('MobileMoneyAwaitingPayment', {
        orderIds: [orderId],
        phoneE164,
        source: 'order-detail',
        orderNumbers: order.order_number ? [order.order_number] : undefined,
        isDepositOrder: true,
        depositAmount: response.deposit_amount ?? depositAmount,
        amountDue: response.amount_due ?? amountDue,
        currency: order.currency,
      });
    } catch (e: unknown) {
      // Handle ALL 409 codes as soft poll/retry-once: open await/poll without hard error
      // Nest contract (PR #288 @ 1c260326):
      // - DEPOSIT_PAYMENT_PENDING → existing pending tx
      // - DEPOSIT_PAYMENT_PROCESSING → prior MoMo success/authorized, deposit unpaid
      // - CONCURRENT_RETRY_DETECTED → soft race, poll/retry-once
      const errorCode = (e as any)?.code;
      if (
        errorCode === 'DEPOSIT_PAYMENT_PENDING' ||
        errorCode === 'DEPOSIT_PAYMENT_PROCESSING' ||
        errorCode === 'CONCURRENT_RETRY_DETECTED'
      ) {
        navigation.navigate('MobileMoneyAwaitingPayment', {
          orderIds: [orderId],
          phoneE164,
          source: 'order-detail',
          orderNumbers: order.order_number ? [order.order_number] : undefined,
          isDepositOrder: true,
          depositAmount,
          amountDue,
          currency: order.currency,
        });
        return;
      }
      
      // Hard error: show message
      setSnack(
        e instanceof Error
          ? e.message
          : t('deposit.paymentError', 'Failed to start deposit payment')
      );
    } finally {
      setPayDepositLoading(false);
    }
  };

  const onBarAction = (actionId: string) => {
    if (actionId === 'reorder') {
      void reorderFlow.onReorderPress();
      return;
    }
    if (actionId === 'pay') {
      if (depositIsPending) {
        void runPayDeposit();
        return;
      }
      if (
        order.pay_after_merchant_confirm === true &&
        order.current_status === 'confirmed'
      ) {
        scrollRef.current?.scrollTo({ y: paymentSectionY.current, animated: true });
        return;
      }
      if (order.payment_timing === 'pay_at_pickup') {
        setPayPickupOpen(true);
        return;
      }
      scrollRef.current?.scrollTo({ y: paymentSectionY.current, animated: true });
      return;
    }
    if (actionId === 'rate') {
      const mode = eligibility?.canRateAgent
        ? 'agent'
        : eligibility?.canRateItem
          ? 'item'
          : null;
      if (mode) setRateMode(mode);
      return;
    }
    if (actionId === 'confirm_receipt') {
      if (confirmState?.confirmVariant && !confirmState.isStripeRail) {
        void navigateToDeliveryConfirm(order.id, 'in_app');
        return;
      }
      void runConfirmReceipt();
      return;
    }
    if (actionId === 'complete') {
      void runCompleteOrder();
      return;
    }
    if (actionId === 'cancel') {
      if (showForfeitDialog) {
        setForfeitCancelOpen(true);
      } else {
        setCancelOpen(true);
      }
      trackCancellationEvent('cancellation_dialog_opened', {
        orderId: order.id,
        orderStatus: status,
        paymentSource: (order as { payment_source?: string }).payment_source ?? '',
      });
      return;
    }
    if (actionId === 'ask_if_ready') {
      void (async () => {
        setActionLoading(true);
        try {
          await agentApi.orders.remindReady(orderId);
          setSnack(
            t(
              'orderActions.askIfReadySuccess',
              'We asked the store if your order is ready'
            )
          );
          void refetch();
        } catch (e: unknown) {
          setSnack(
            e instanceof Error
              ? e.message
              : t('common.genericError', 'Something went wrong.')
          );
        } finally {
          setActionLoading(false);
        }
      })();
      return;
    }
    if (actionId === 'switch_to_pickup') {
      setNoAgentOpen(true);
      return;
    }
    if (actionId === 'request_refund') {
      setRefundOpen(true);
      return;
    }
    if (actionId === 'report_problem') {
      setProblemOpen(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView ref={scrollRef} contentContainerStyle={scrollPad} showsVerticalScrollIndicator={false}>

        <EatInUnavailableNotice order={order} />

        <ClientOrderHeroCard
          order={order}
          locale={locale}
          status={status}
          vm={clientVm}
          onRefetch={() => void refetch()}
        />

        <OrderNowLine title={nowTitle} subtitle={orderNowSubtitle} />

        {showNoAgentOptions ? (
          <OrderExceptionLine
            title={t('orders.noAgent.bannerTitle', "We couldn't find a nearby courier")}
            body={t(
              'orders.noAgent.bannerBody',
              'Switch to store pickup (fee waived) or cancel the order.'
            )}
            actionLabel={t('orders.noAgent.viewOptions', 'View options')}
            onAction={() => setNoAgentOpen(true)}
          />
        ) : null}

        {order.current_status === 'pending' &&
        (order.busy_extra_prep_minutes ?? 0) > 0 &&
        order.estimated_prep_minutes ? (
          <OrderBusyDemandBanner
            estimatedPrepMinutes={order.estimated_prep_minutes}
            showActions={false}
          />
        ) : null}

        {showTrackingHero ? (
          <ClientTrackingHero
            phase={phaseInfo.phase}
            status={order.current_status}
            fulfillment={order.fulfillment_method}
            agentName={order.assigned_agent?.user?.first_name}
            storeName={order.business_location?.name}
            storeAddress={order.business_location?.address?.address_line_1}
            onOpenMap={showMap ? () => setMapOpen(true) : undefined}
          />
        ) : null}

        {isShipping ? (
          <ShippingTrackingCard
            carrier={order.shipping_carrier}
            trackingNumber={order.shipping_tracking_number}
            shippedAt={order.shipped_at}
          />
        ) : null}

        <ExpandableSection
          title={t('orders.orderItems', 'Items')}
          defaultExpanded
        >
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
                    <View
                      style={[
                        styles.itemThumb,
                        styles.itemThumbFallback,
                        {
                          backgroundColor: colors.pageBackground,
                          borderColor: colors.divider,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="package-variant-closed"
                        size={24}
                        color={colors.text.secondary}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyLarge" numberOfLines={2}>
                      {itemLabel(oi)}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.text.secondary, marginTop: 2 }}
                    >
                      {t('orders.quantity', 'Qty')}: {oi.quantity}
                      {oi.total_price != null
                        ? ` · ${formatCurrency(oi.total_price, cur, locale)}`
                        : ''}
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
        </ExpandableSection>

        <View
          onLayout={(event) => {
            paymentSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <ExpandableSection title={t('orders.detail.money', 'Money')}>
            <OrderClientSummaryCard
              order={order}
              locale={locale}
              onRefetch={() => void refetch()}
              onNotify={(msg) => setSnack(msg)}
              onAwaitingPayment={(params) =>
                navigation.navigate('MobileMoneyAwaitingPayment', params)
              }
              hidePaymentActions
            />
          </ExpandableSection>
        </View>

        <ExpandableSection title={t('orders.detail.peopleAndPlace', 'People & place')}>
          {clientVm?.contacts.recipient ? (
            <View style={{ marginBottom: spacing.sm }}>
              <ContactCard
                title={t('orders.deliveryContactRecipient', 'Recipient')}
                contact={{
                  ...clientVm.contacts.recipient,
                  subtitle: t('orders.recipientReceives', 'Receives this order'),
                }}
              />
            </View>
          ) : null}
          {clientVm?.contacts.business ? (
            <View style={{ marginBottom: spacing.sm }}>
              <ContactCard
                title={
                  isPickup
                    ? t('orders.contact.store', 'Store contact')
                    : t('orders.client.actions.contactBusiness', 'Contact business')
                }
                contact={clientVm.contacts.business}
              />
            </View>
          ) : null}
          {clientVm?.contacts.agent ? (
            <View style={{ marginBottom: spacing.sm }}>
              <ContactCard
                title={t('orders.client.actions.contactAgent', 'Contact delivery agent')}
                contact={clientVm.contacts.agent}
              />
            </View>
          ) : null}
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
          {!isPickup ? (
            <InfoRow
              icon="map-marker-outline"
              label={t('orders.deliveryAddressLabel', 'Deliver to')}
              value={formatAddress(order.delivery_address) || '—'}
              vertical
              truncate={false}
            />
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
        </ExpandableSection>

      </ScrollView>

      {showStickyBar ? (
        <OrderActionBar
          ranked={ranked}
          primaryLabel={primaryLabel}
          accentPrimary={stickyPrimaryId === 'pay'}
          busy={actionLoading || payDepositLoading || reorderFlow.loading}
          renderPrimary={
            stickyPrimaryId === 'send_pin'
              ? () => (
                  <SendDeliveryPinButton
                    orderId={orderId}
                    pinAudience={isStorePickupOrder(order) ? 'business' : 'agent'}
                    onSent={onPinSent}
                    onError={onPinError}
                  />
                )
              : null
          }
          onAction={onBarAction}
        />
      ) : null}

      <AgentLocationMapModal visible={mapOpen} orderId={orderId} onDismiss={() => setMapOpen(false)} />
      {!depositIsPending && order.payment_timing === 'pay_at_pickup' ? (
        <ClientPickupPaymentSheet
          visible={payPickupOpen}
          order={order}
          loading={payPickupLoading}
          onDismiss={() => setPayPickupOpen(false)}
          onSubmit={runPayAtPickup}
        />
      ) : null}
      <ReportDeliveryProblemDialog
        visible={problemOpen}
        submitting={actionLoading}
        onDismiss={() => setProblemOpen(false)}
        onSubmit={(description) => void runReportProblem(description)}
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
      
      <ForfeitDepositCancelDialog
        visible={forfeitCancelOpen}
        mode={order.current_status === 'ready_for_pickup' ? 'ready_for_pickup' : 'out_for_delivery'}
        depositAmount={depositAmount ?? 0}
        currency={order.currency ?? 'XAF'}
        onKeep={() => {
          setForfeitCancelOpen(false);
          trackCancellationEvent('forfeit_cancel_abandoned', {
            orderId: order.id,
            orderStatus: order.current_status,
          });
        }}
        onCancelAndForfeit={async () => {
          setCancellingForfeit(true);
          trackCancellationEvent('forfeit_cancel_confirmed', {
            orderId: order.id,
            orderStatus: order.current_status,
          });
          try {
            // Find a valid cancellation reason from the preview
            // Prefer "other" reason, or use the first available reason
            const availableReasons = forfeitPreview?.availableCancellationReasons ?? [];
            const otherReason = availableReasons.find(r => r.value === 'other');
            const selectedReasonId = otherReason?.id ?? availableReasons[0]?.id ?? 1;
            
            const res = await agentApi.orders.cancel({
              orderId: order.id,
              cancellationReasonId: selectedReasonId,
              notes: 'Cancelled with deposit forfeit',
            });
            if (res.success) {
              setForfeitCancelOpen(false);
              setSnack(t('orderActions.cancelSuccess', 'Order cancelled successfully.'));
              void refetch();
            } else {
              setSnack(res.message ?? t('orderActions.cancelFailed', 'Could not cancel order.'));
            }
          } catch (e: any) {
            setSnack(e?.message ?? t('orderActions.cancelFailed', 'Could not cancel order.'));
          } finally {
            setCancellingForfeit(false);
          }
        }}
        onDismiss={() => setForfeitCancelOpen(false)}
        loading={cancellingForfeit}
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
      <ReorderCartConflictSheet
        visible={reorderFlow.sheetOpen}
        allowAdd={reorderFlow.allowAdd}
        otherStoreBlocked={reorderFlow.otherStoreBlocked}
        onReplace={reorderFlow.onReplace}
        onAdd={reorderFlow.onAdd}
        onDismiss={reorderFlow.onDismissSheet}
      />
      <ClientRefundRequestButton
        orderId={order.id}
        hideButton
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSubmitted={() => {
          setSnack(t('orders.refunds.requested', 'Your refund request was sent.'));
          void refetch();
        }}
      />
      <Snackbar
        visible={!!(snack || reorderFlow.snack)}
        onDismiss={() => {
          setSnack(null);
          reorderFlow.setSnack(null);
        }}
        duration={4000}
      >
        {reorderFlow.snack ?? snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  itemThumb: { width: 52, height: 52, borderRadius: 10 },
  itemThumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  subLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
});
