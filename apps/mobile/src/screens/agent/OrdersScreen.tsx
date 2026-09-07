import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentOrders } from '../../hooks/useAgentOrders';
import { useActiveDeliveryPinForComplete } from '../../hooks/useActiveDeliveryPinForComplete';
import { useFailedDeliveryReasons } from '../../hooks/useFailedDeliveryReasons';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { agentApi } from '../../services/agentApi';
import type { OrdersStackParamList } from '../shared/orderDetail/types';
import type { Order } from '../../types/agent';
import { sortOrdersByModifiedDesc } from '../../utils/orderListSort';
import { mergeOrderForDeliverySuccess } from '../../utils/mergeOrderForDeliverySuccess';
import { CompleteDeliveryPinDialog } from '../../components/dialogs/CompleteDeliveryPinDialog';
import { DeliveryCompleteSuccessModal } from '../../components/dialogs/DeliveryCompleteSuccessModal';
import { FailDeliveryReasonDialog } from '../../components/dialogs/FailDeliveryReasonDialog';
import { MarkPaidCashExceptionDialog } from '../../components/dialogs/MarkPaidCashExceptionDialog';
import { RequestPayAtDeliveryDialog } from '../../components/dialogs/RequestPayAtDeliveryDialog';
import { ActionLoadingDialog } from '../../components/feedback/ActionLoadingDialog';
import { OrderCardActive } from '../../components/agent/OrderCardCompact';
import { statusToPrimaryAction } from '../../components/agent/DeliveryStatusIndicator';
import type { ActionLoadingKind } from '../../components/feedback/actionLoadingKinds';
import { OrdersActivityGroupedFooter } from '../../components/orders/OrdersActivityGroupedFooter';
import { useOrdersActivityPartition } from '../../hooks/useOrdersActivityPartition';
import { orderNeedsPayAtDeliveryAgentActions } from '../../utils/orderPaymentAgentActions';
import { isCarrierShipping } from '../../utils/fulfillmentMethod';
import { APP_FEATURES } from '../../constants/appFeatures';

type Nav = NativeStackNavigationProp<OrdersStackParamList, 'OrdersList'>;
type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
type LifecycleActionKey = 'pickUp' | 'startTransit' | 'outForDelivery';

/** Determine the single primary action for a card given its status. */
function primaryActionForOrder(
  order: Order,
  callbacks: {
    onPickUp: () => void;
    onStartTransit: () => void;
    onOutForDelivery: () => void;
    onCompleteDelivery: () => void;
    onRequestPayment: () => void;
  }
): (() => void) | null {
  if (isCarrierShipping(order.fulfillment_method)) return null;
  const payAt = orderNeedsPayAtDeliveryAgentActions(order);
  switch (order.current_status) {
    case 'assigned_to_agent':
      return callbacks.onPickUp;
    case 'picked_up':
      return APP_FEATURES.AGENT_MARK_AS_IN_TRANSIT ? callbacks.onStartTransit : callbacks.onOutForDelivery;
    case 'in_transit':
      return callbacks.onOutForDelivery;
    case 'out_for_delivery':
      return payAt ? callbacks.onRequestPayment : callbacks.onCompleteDelivery;
    default:
      return null;
  }
}

export default function OrdersScreen({ navigation }: { navigation: Nav }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const listBottomPadding = useMainTabContentBottomPadding();
  const failLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const { reasons: failReasons } = useFailedDeliveryReasons(failLang);

  const {
    categorized,
    loading,
    error,
    refetch,
    pickUp,
    startTransit,
    outForDelivery,
    completeDelivery,
    failDelivery,
    dropOrder,
    initiatePayAtDeliveryPayment,
    markPaidInCashException,
  } = useAgentOrders();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionBusyOrderId, setActionBusyOrderId] = useState<string | null>(null);

  // Reset filter and refresh data every time this screen comes into focus
  // (tab press from another tab, pop back from OrderDetail, etc.)
  useFocusEffect(
    useCallback(() => {
      setStatusFilter('all');
      void refetch();
    }, [refetch])
  );
  const [loadingOverlayKind, setLoadingOverlayKind] = useState<ActionLoadingKind | null>(null);
  const [lifecycle, setLifecycle] = useState<{ orderId: string; key: LifecycleActionKey } | null>(null);
  const [completePinOrder, setCompletePinOrder] = useState<Order | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [deliverySuccessOrder, setDeliverySuccessOrder] = useState<Order | null>(null);
  const [failOrder, setFailOrder] = useState<Order | null>(null);
  const [failReasonId, setFailReasonId] = useState('');
  const [failNotes, setFailNotes] = useState('');
  const [failSubmitting, setFailSubmitting] = useState(false);
  const [requestPayOrder, setRequestPayOrder] = useState<Order | null>(null);
  const [cashOrder, setCashOrder] = useState<Order | null>(null);
  const [payDialogLoading, setPayDialogLoading] = useState(false);

  const completePinVisible = completePinOrder !== null;
  const {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  } = useActiveDeliveryPinForComplete(completePinOrder?.id, completePinVisible);

  const closeCompletePinDialog = useCallback(() => {
    setCompletePinOrder(null);
    setCompleteError(null);
    resetSharedPinState();
  }, [resetSharedPinState]);

  const allOrders = useMemo(
    () => [...categorized.active, ...categorized.completed, ...categorized.cancelled],
    [categorized]
  );

  const displayedOrders = useMemo(() => {
    let base: Order[] =
      statusFilter === 'active'
        ? categorized.active
        : statusFilter === 'completed'
          ? categorized.completed
          : statusFilter === 'cancelled'
            ? categorized.cancelled
            : allOrders;
    return sortOrdersByModifiedDesc(base);
  }, [allOrders, categorized, statusFilter]);

  const groupInactive = statusFilter === 'all';
  const {
    active: listActive,
    completed: listCompleted,
    cancelled: listCancelled,
    hasInactive,
  } = useOrdersActivityPartition(displayedOrders, groupInactive);

  const filterChips = useMemo(
    () => [
      { id: 'all' as const, label: t('orders.filterAll', 'All'), count: allOrders.length },
      { id: 'active' as const, label: t('agent.orders.sectionActive', 'In progress'), count: categorized.active.length },
      { id: 'completed' as const, label: t('agent.orders.sectionCompleted', 'Delivered'), count: categorized.completed.length },
    ] as const,
    [allOrders.length, categorized.active.length, categorized.completed.length, t]
  );

  const openDetail = useCallback((orderId: string) => navigation.navigate('OrderDetail', { orderId }), [navigation]);

  const runDropOrder = useCallback(
    async (orderId: string) => {
      setLoadingOverlayKind('drop_order');
      setActionBusyOrderId(orderId);
      try { await dropOrder(orderId); }
      catch (e: unknown) { Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e)); }
      finally { setActionBusyOrderId(null); setLoadingOverlayKind(null); }
    },
    [dropOrder, t]
  );

  const confirmDropOrder = useCallback(
    (order: Order) => {
      Alert.alert(
        t('agent.orders.detail.dropDialogTitle', 'Drop this order?'),
        t('agent.orders.detail.dropConfirm', 'This will release the order back to available.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('agent.orders.detail.dropOrder', 'Drop order'), style: 'destructive', onPress: () => void runDropOrder(order.id) },
        ]
      );
    },
    [runDropOrder, t]
  );

  const handleLifecycleConfirm = useCallback(async () => {
    if (!lifecycle) return;
    const { orderId, key } = lifecycle;
    const overlayKind: ActionLoadingKind =
      key === 'pickUp' ? 'pick_up' : key === 'startTransit' ? 'start_transit' : 'out_for_delivery';
    setLifecycle(null);
    setLoadingOverlayKind(overlayKind);
    setActionBusyOrderId(orderId);
    try {
      if (key === 'pickUp') await pickUp(orderId);
      else if (key === 'startTransit') await startTransit(orderId);
      else await outForDelivery(orderId);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusyOrderId(null);
      setLoadingOverlayKind(null);
    }
  }, [lifecycle, outForDelivery, pickUp, startTransit, t]);

  const handleCompleteWithSharedPin = useCallback(async () => {
    const snap = completePinOrder;
    if (!snap) return;
    setCompleteSubmitting(true);
    setCompleteError(null);
    setActionBusyOrderId(snap.id);
    try {
      const res = await completeDelivery(snap.id, {
        useLatestSharedPin: true,
        pinMessageId: autoPinMessageId ?? undefined,
      });
      closeCompletePinDialog();
      setDeliverySuccessOrder(mergeOrderForDeliverySuccess(snap, res.order ?? null));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCompleteError(msg);
      Alert.alert(t('common.error'), msg);
    } finally {
      setCompleteSubmitting(false);
      setActionBusyOrderId(null);
    }
  }, [autoPinMessageId, closeCompletePinDialog, completeDelivery, completePinOrder, t]);

  const handleCompleteDeliverySubmit = useCallback(
    async (pin: string) => {
      const trimmed = pin.trim();
      const snap = completePinOrder;
      if (!snap || trimmed.length !== 4) {
        setCompleteError(t('orders.completeDelivery.invalidPin', 'The PIN must be exactly 4 digits.'));
        return;
      }
      setCompleteSubmitting(true);
      setCompleteError(null);
      setActionBusyOrderId(snap.id);
      try {
        const res = await completeDelivery(snap.id, { pin: trimmed });
        closeCompletePinDialog();
        setDeliverySuccessOrder(mergeOrderForDeliverySuccess(snap, res.order ?? null));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setCompleteError(msg);
        Alert.alert(t('common.error'), msg);
      } finally {
        setCompleteSubmitting(false);
        setActionBusyOrderId(null);
      }
    },
    [closeCompletePinDialog, completeDelivery, completePinOrder, t]
  );

  const handleFailConfirm = useCallback(async () => {
    if (!failOrder || !failReasonId) return;
    setFailSubmitting(true);
    setActionBusyOrderId(failOrder.id);
    try {
      await failDelivery(failOrder.id, failReasonId, failNotes.trim() || undefined);
      setFailOrder(null);
      setFailReasonId('');
      setFailNotes('');
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setFailSubmitting(false);
      setActionBusyOrderId(null);
    }
  }, [failDelivery, failNotes, failOrder, failReasonId, t]);

  const handlePayAtDeliveryRequest = useCallback(
    async (phoneOverride?: string) => {
      if (!requestPayOrder) return;
      setPayDialogLoading(true);
      setActionBusyOrderId(requestPayOrder.id);
      try {
        await initiatePayAtDeliveryPayment(requestPayOrder.id, phoneOverride);
        setRequestPayOrder(null);
        Alert.alert(t('common.done', { defaultValue: 'Done' }), t('agent.orders.payAtDelivery.successRequest', { defaultValue: 'Payment request sent.' }));
      } catch (e: unknown) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
      } finally {
        setPayDialogLoading(false);
        setActionBusyOrderId(null);
      }
    },
    [initiatePayAtDeliveryPayment, requestPayOrder, t]
  );

  const handleCashException = useCallback(
    async (notes: string) => {
      if (!cashOrder) return;
      setPayDialogLoading(true);
      setActionBusyOrderId(cashOrder.id);
      try {
        await markPaidInCashException(cashOrder.id, notes);
        setCashOrder(null);
        Alert.alert(t('common.done', { defaultValue: 'Done' }), t('agent.orders.payAtDelivery.successCash', { defaultValue: 'Cash exception recorded.' }));
      } catch (e: unknown) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
      } finally {
        setPayDialogLoading(false);
        setActionBusyOrderId(null);
      }
    },
    [cashOrder, markPaidInCashException, t]
  );

  const getPrimaryAction = useCallback(
    (order: Order) => {
      const onPickUp = () => setLifecycle({ orderId: order.id, key: 'pickUp' });
      const onStartTransit = () => setLifecycle({ orderId: order.id, key: 'startTransit' });
      const onOutForDelivery = () => setLifecycle({ orderId: order.id, key: 'outForDelivery' });
      const onCompleteDelivery = () => { setCompletePinOrder(order); setCompleteError(null); };
      const onRequestPayment = () => setRequestPayOrder(order);
      return primaryActionForOrder(order, { onPickUp, onStartTransit, onOutForDelivery, onCompleteDelivery, onRequestPayment });
    },
    []
  );

  const showQuickActionLoadingOverlay =
    (actionBusyOrderId !== null && completePinOrder === null && failOrder === null && requestPayOrder === null && cashOrder === null);

  const renderItem = useCallback(
    ({ item }: { item: Order }) => {
      const primaryActionLabel = statusToPrimaryAction(item.current_status, t) ?? t('common.details', 'Details');
      const primaryAction = getPrimaryAction(item);
      const isBusy = actionBusyOrderId === item.id;

      return (
        <OrderCardActive
          order={item}
          primaryActionLabel={primaryActionLabel}
          onPrimaryAction={primaryAction ? primaryAction : () => openDetail(item.id)}
          onViewDetails={() => openDetail(item.id)}
          isBusy={isBusy}
        />
      );
    },
    [actionBusyOrderId, getPrimaryAction, openDetail, t]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <View style={styles.headerRow}>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
            {t('agent.activeOrders', 'Active Orders')}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        {/* Filter chips */}
        <View style={styles.chipsRow}>
          {filterChips.map(({ id, label, count }) => {
            const selected = statusFilter === id;
            return (
              <Pressable
                key={id}
                onPress={() => setStatusFilter(id)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary.main : colors.surface,
                    borderColor: selected ? colors.primary.main : colors.divider,
                    borderRadius: borderRadius.full,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  variant="labelMedium"
                  style={[styles.chipText, { color: selected ? colors.primary.contrast : colors.text.secondary }]}
                >
                  {label} {count > 0 ? `· ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {hasInactive && listActive.length > 0 ? (
          <Text
            variant="titleSmall"
            style={{
              color: colors.text.primary,
              fontWeight: '700',
              marginTop: spacing.sm,
            }}
          >
            {t('orders.sections.activeOrders', 'Active orders')}
          </Text>
        ) : null}
      </View>

      {/* List */}
      <FlatList
        data={listActive}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: listBottomPadding }}
        alwaysBounceVertical={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          groupInactive ? (
            <OrdersActivityGroupedFooter
              completed={listCompleted}
              cancelled={listCancelled}
              renderOrder={(order) => {
                const primaryActionLabel =
                  statusToPrimaryAction(order.current_status, t) ??
                  t('common.details', 'Details');
                const primaryAction = getPrimaryAction(order);
                const isBusy = actionBusyOrderId === order.id;
                return (
                  <OrderCardActive
                    order={order}
                    primaryActionLabel={primaryActionLabel}
                    onPrimaryAction={
                      primaryAction ? primaryAction : () => openDetail(order.id)
                    }
                    onViewDetails={() => openDetail(order.id)}
                    isBusy={isBusy}
                  />
                );
              }}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refetch()}
            colors={[colors.primary.main]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="cloud-off-outline" size={48} color={colors.text.disabled} />
              <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.text.secondary }]}>
                {t('common.listLoadError', 'Unable to load orders.')}
              </Text>
              <Pressable onPress={() => void refetch()} style={{ padding: 8 }}>
                <Text variant="labelMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
                  {t('common.retry', 'Retry')}
                </Text>
              </Pressable>
            </View>
          ) : hasInactive ? null : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={56} color={colors.text.disabled} />
              <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.text.primary }]}>
                {t('agent.orders.empty', 'No orders')}
              </Text>
              <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.text.secondary }]}>
                {statusFilter === 'all'
                  ? t('agent.home.checkBackSoon', 'Claim orders from the Available tab')
                  : t('orders.noMatchFilter', 'No orders for this filter')}
              </Text>
            </View>
          )
        }
      />

      {/* Lifecycle confirm dialog (reuses Alert) */}
      {lifecycle ? (
        (() => {
          const cfg = {
            pickUp: { title: t('agent.orders.detail.actionConfirm.pickUpTitle', 'Confirm pickup'), msg: t('agent.orders.detail.actionConfirm.pickUpMessage', 'Mark as picked up?') },
            startTransit: { title: t('agent.orders.detail.actionConfirm.inTransitTitle', 'Confirm in transit'), msg: t('agent.orders.detail.actionConfirm.inTransitMessage', 'Mark as in transit?') },
            outForDelivery: { title: t('agent.orders.detail.actionConfirm.outForDeliveryTitle', 'Confirm out for delivery'), msg: t('agent.orders.detail.actionConfirm.outForDeliveryMessage', 'Mark as out for delivery?') },
          }[lifecycle.key];
          Alert.alert(cfg.title, cfg.msg, [
            { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => setLifecycle(null) },
            { text: t('common.confirm', 'Confirm'), onPress: () => void handleLifecycleConfirm() },
          ]);
          return null;
        })()
      ) : null}

      <CompleteDeliveryPinDialog
        visible={completePinVisible}
        onDismiss={closeCompletePinDialog}
        onSubmit={(pin) => void handleCompleteDeliverySubmit(pin)}
        onSubmitSharedPin={() => void handleCompleteWithSharedPin()}
        submitting={completeSubmitting}
        errorText={completeError}
        onPinEdited={() => setCompleteError(null)}
        autoSharedPin={autoSharedPin}
        resolvingSharedPin={resolvingSharedPin}
        noSharedPin={noSharedPin}
      />

      <DeliveryCompleteSuccessModal
        visible={!!deliverySuccessOrder}
        order={deliverySuccessOrder}
        onClose={() => setDeliverySuccessOrder(null)}
      />

      <FailDeliveryReasonDialog
        visible={!!failOrder}
        order={failOrder}
        reasons={failReasons}
        selectedReasonId={failReasonId}
        notes={failNotes}
        submitting={failSubmitting}
        onSelectReason={setFailReasonId}
        onChangeNotes={setFailNotes}
        onDismiss={() => { if (!failSubmitting) { setFailOrder(null); setFailReasonId(''); setFailNotes(''); } }}
        onConfirm={() => void handleFailConfirm()}
      />

      <RequestPayAtDeliveryDialog
        visible={!!requestPayOrder}
        order={requestPayOrder}
        loading={payDialogLoading}
        onDismiss={() => setRequestPayOrder(null)}
        onConfirm={handlePayAtDeliveryRequest}
      />

      <MarkPaidCashExceptionDialog
        visible={!!cashOrder}
        order={cashOrder}
        loading={payDialogLoading}
        onDismiss={() => setCashOrder(null)}
        onConfirm={handleCashException}
      />

      <ActionLoadingDialog
        visible={showQuickActionLoadingOverlay}
        action={loadingOverlayKind ?? 'generic_update'}
        message={undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontWeight: '700', flex: 1 },
  iconBtn: { padding: 6 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  chipText: { fontWeight: '600' },
  list: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { textAlign: 'center', fontWeight: '700' },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
