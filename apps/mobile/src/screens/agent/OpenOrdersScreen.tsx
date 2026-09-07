import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useOpenOrders } from '../../hooks/useOpenOrders';
import { useAgentVerificationStatus } from '../../hooks/useAgentVerificationStatus';
import { useStripeConnect } from '../../hooks/useStripeConnect';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { agentApi } from '../../services/agentApi';
import type { Order } from '../../types/agent';
import { clientDisplayName } from '../../utils/orderCardHelpers';
import { orderModifiedAtMs } from '../../utils/orderListSort';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { AgentClaimConfirmDialog } from '../../components/dialogs/AgentClaimConfirmDialog';
import { useAgentLocationFeatures } from '../../hooks/useAgentLocationFeatures';
import { ClaimTopupFormDialog } from '../../components/dialogs/ClaimTopupFormDialog';
import { SimpleMessageDialog } from '../../components/dialogs/SimpleMessageDialog';
import { ActionLoadingDialog } from '../../components/feedback/ActionLoadingDialog';
import { OrderCardCompact } from '../../components/agent/OrderCardCompact';
import { OrderMapView } from '../../components/agent/OrderMapView';
import { OrderViewToggle } from '../../components/agent/OrderViewToggle';
import type { OrderViewMode } from '../../components/agent/OrderViewToggle';
import { useStore } from '../../stores/RootStore';
import { resolveDefaultClaimTopupPhone } from '../../utils/defaultClaimTopupPhone';

export default function OpenOrdersScreen() {
  const { t } = useTranslation();
  const { auth } = useStore();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<any>();
  const tabScrollBottomPad = useMainTabContentBottomPadding(24);
  const { openOrders, loading, error, refetch, claimOrder, claimOrderWithTopup, canClaim: ordersCanClaim } = useOpenOrders();
  const {
    agentStatus,
    isVerified,
    idDocumentStatus,
    loading: verificationLoading,
    refetch: refetchVerification,
  } = useAgentVerificationStatus();
  const { status: connectStatus, actionLoading: stripeActionLoading, startOnboarding } =
    useStripeConnect();
  const isStripeRail = connectStatus?.paymentRail === 'stripe';
  const stripeReady =
    !!connectStatus?.connected &&
    (connectStatus?.status === 'active' ||
      (!!connectStatus?.chargesEnabled && !!connectStatus?.payoutsEnabled));
  const effectiveCanClaim = ordersCanClaim || (isStripeRail && stripeReady);

  useEffect(() => {
    if (stripeReady && !isVerified) {
      void refetchVerification();
    }
  }, [stripeReady, isVerified, refetchVerification]);

  const prevVerifiedRef = useRef(isVerified);
  useEffect(() => {
    const wasVerified = prevVerifiedRef.current === true;
    prevVerifiedRef.current = isVerified;
    if (isVerified && !wasVerified) {
      void refetch();
    }
  }, [isVerified, refetch]);

  const prevStripeReadyRef = useRef(stripeReady);
  useEffect(() => {
    const wasReady = prevStripeReadyRef.current === true;
    prevStripeReadyRef.current = stripeReady;
    if (stripeReady && !wasReady) {
      void refetch();
    }
  }, [stripeReady, refetch]);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [topupModalOrderId, setTopupModalOrderId] = useState<string | null>(null);
  const [topupPhone, setTopupPhone] = useState('');
  const [claimConfirm, setClaimConfirm] = useState<{ order: Order; holdAmount: number } | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<OrderViewMode>('list');

  const {
    consent,
    canClaim: locationCanClaim,
    osForegroundGranted,
    promptPermissionsWithDisclosure,
    runPermissionFlow,
    disclosurePermissionLoading,
  } = useAgentLocationFeatures();

  const handleLocationBlocked = useCallback(() => {
    if (consent === 'not_shown') {
      void promptPermissionsWithDisclosure?.();
      return;
    }
    if (consent === 'deferred') {
      Alert.alert(
        t('agent.locationTracking.deferredNudgeTitle', 'Location required'),
        t('agent.locationTracking.deferredNudgeMessage', 'Accept location disclosure and enable location permissions.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('agent.locationTracking.enableTracking', 'Enable tracking'), onPress: () => void runPermissionFlow?.() },
        ]
      );
      return;
    }
    if (consent === 'accepted' && !osForegroundGranted) {
      Alert.alert(
        t('agent.locationTracking.enableSettingsTitle', 'Enable location'),
        t('agent.locationTracking.enableSettingsMessage', 'Turn on location in your device settings.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('agent.locationTracking.openSettings', 'Open device settings'), onPress: () => void Linking.openSettings() },
        ]
      );
    }
  }, [consent, osForegroundGranted, promptPermissionsWithDisclosure, runPermissionFlow, t]);

  const showStripeClaimFundingUnavailable = useCallback(() => {
    setInfoDialog({
      title: t('agent.claimOrder.stripeFundingUnavailableTitle', 'Claim unavailable'),
      message: t(
        'agent.claimOrder.stripeFundingUnavailableBody',
        'This order requires account funding, but Mobile Money top-up is not available in your country. Please contact support.'
      ),
    });
  }, [t]);

  const executeClaimOrder = useCallback(
    async (order: Order) => {
      setClaimingId(order.id);
      try {
        const availability = await agentApi.orders.getClaimAvailability(order.id);
        if (!availability.orderOpenStatus) {
          setInfoDialog({
            title: t('orders.orderNoLongerOpenTitle', { defaultValue: 'Order not available' }),
            message: availability.message || t('orders.orderNoLongerOpenMessage', { defaultValue: 'This order is no longer available.' }),
          });
          await refetch();
          return;
        }
        if (availability.needsTopUpToClaim) {
          if (isStripeRail) {
            showStripeClaimFundingUnavailable();
            return;
          }
          setTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
          setTopupModalOrderId(order.id);
          return;
        }
        await claimOrder(order.id);
      } catch (e) {
        setInfoDialog({ title: t('common.error'), message: e instanceof Error ? e.message : t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }) });
      } finally {
        setClaimingId(null);
      }
    },
    [auth.user, claimOrder, isStripeRail, refetch, showStripeClaimFundingUnavailable, t]
  );

  useFocusEffect(
    useCallback(() => {
      void refetchVerification();
    }, [refetchVerification])
  );

  const idVerificationPending =
    !isStripeRail && !isVerified && idDocumentStatus === 'pending';
  const needsIdUpload =
    !isStripeRail &&
    !isVerified &&
    (idDocumentStatus === 'missing' || idDocumentStatus === 'rejected');
  const idRejected = !isStripeRail && !isVerified && idDocumentStatus === 'rejected';

  const claimBlockedLabel = useMemo(() => {
    if (isStripeRail) {
      return t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim');
    }
    if (idVerificationPending) {
      return t('agent.openOrders.idPendingCta', 'Pending ID approval');
    }
    if (idRejected) {
      return t('agent.openOrders.idRejectedCta', 'Re-upload ID');
    }
    return t('agent.openOrders.uploadIdToClaim', 'Upload ID to claim');
  }, [idRejected, idVerificationPending, isStripeRail, t]);

  const handleSetupRequired = useCallback(() => {
    if (isStripeRail) {
      if (!stripeActionLoading) void startOnboarding();
      return;
    }
    if (idVerificationPending) {
      setInfoDialog({
        title: t('agent.openOrders.idPendingTitle', 'ID under review'),
        message: t(
          'agent.openOrders.idPendingBody',
          'We received your identification document. A reviewer will approve it soon. You can claim deliveries once your account is verified.'
        ),
      });
      return;
    }
    navigation.navigate('Documents');
  }, [
    idVerificationPending,
    isStripeRail,
    navigation,
    startOnboarding,
    stripeActionLoading,
    t,
  ]);

  const confirmClaimOrder = useCallback(
    async (order: Order) => {
      if (!effectiveCanClaim) {
        handleSetupRequired();
        return;
      }
      if (!locationCanClaim) {
        handleLocationBlocked();
        return;
      }
      await executeClaimOrder(order);
    },
    [
      effectiveCanClaim,
      locationCanClaim,
      executeClaimOrder,
      handleLocationBlocked,
      handleSetupRequired,
    ]
  );

  const handleClaimPress = useCallback(
    async (order: Order) => {
      setClaimingId(order.id);
      try {
        const availability = await agentApi.orders.getClaimAvailability(order.id);
        if (!availability.orderOpenStatus) {
          setInfoDialog({
            title: t('orders.orderNoLongerOpenTitle', { defaultValue: 'Order not available' }),
            message: availability.message || t('orders.orderNoLongerOpenMessage', { defaultValue: 'This order is no longer available.' }),
          });
          await refetch();
          return;
        }
        if (availability.hasEnoughFundsForHold) {
          setClaimConfirm({ order, holdAmount: isStripeRail ? 0 : availability.holdAmount ?? 0 });
          return;
        }
        if (isStripeRail) {
          showStripeClaimFundingUnavailable();
          return;
        }
        setTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
        setTopupModalOrderId(order.id);
      } catch (e) {
        setInfoDialog({ title: t('common.error'), message: e instanceof Error ? e.message : t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }) });
      } finally {
        setClaimingId(null);
      }
    },
    [auth.user, confirmClaimOrder, isStripeRail, refetch, showStripeClaimFundingUnavailable, t]
  );

  const onConfirmClaimWithTopup = useCallback(async (phoneE164: string) => {
    const id = topupModalOrderId;
    if (!id) return;
    setClaimingId(id);
    try {
      const availability = await agentApi.orders.getClaimAvailability(id);
      if (!availability.orderOpenStatus) {
        setTopupModalOrderId(null);
        setTopupPhone('');
        setInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', { defaultValue: 'Order not available' }),
          message: availability.message || t('orders.orderNoLongerOpenMessage', { defaultValue: 'This order is no longer available.' }),
        });
        await refetch();
        return;
      }
      if (availability.hasEnoughFundsForHold) {
        setTopupModalOrderId(null);
        setTopupPhone('');
        const order = openOrders.find((o) => o.id === id);
        if (order) {
          setClaimConfirm({ order, holdAmount: isStripeRail ? 0 : availability.holdAmount ?? 0 });
        } else {
          await refetch();
        }
        return;
      }
      if (isStripeRail) {
        setTopupModalOrderId(null);
        setTopupPhone('');
        showStripeClaimFundingUnavailable();
        return;
      }
      setTopupModalOrderId(null);
      setTopupPhone('');
      if (!locationCanClaim) { handleLocationBlocked(); return; }
      await claimOrderWithTopup(id, phoneE164);
      setInfoDialog({ title: t('agent.claimOrder.paymentApprovalTitle', { defaultValue: 'Check your phone' }), message: t('agent.claimOrder.successMessage', { defaultValue: 'Payment request sent!' }) });
    } catch (e) {
      setInfoDialog({ title: t('common.error'), message: e instanceof Error ? e.message : 'Failed to claim order' });
    } finally {
      setClaimingId(null);
    }
  }, [locationCanClaim, claimOrderWithTopup, handleLocationBlocked, isStripeRail, openOrders, refetch, showStripeClaimFundingUnavailable, t, topupModalOrderId]);

  const closeTopupModal = useCallback(() => {
    setTopupModalOrderId(null);
    setTopupPhone('');
  }, []);

  const sortByExpressThenDate = useCallback(
    (a: Order, b: Order) => {
      if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
      if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;
      return orderModifiedAtMs(b) - orderModifiedAtMs(a);
    },
    []
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return openOrders;
    return openOrders.filter((o) => {
      const num = (o.order_number ?? '').toLowerCase();
      const biz = (o.business?.name ?? '').toLowerCase();
      const client = clientDisplayName(o.client).toLowerCase();
      return num.includes(q) || biz.includes(q) || client.includes(q);
    });
  }, [openOrders, searchQuery]);

  const sortedOrders = useMemo(
    () => filteredOrders.filter((o) => o.current_status === 'ready_for_pickup').sort(sortByExpressThenDate),
    [filteredOrders, sortByExpressThenDate]
  );

  const goToOrderDetail = useCallback(
    (orderId: string) => {
      (navigation as any).navigate('Orders', { screen: 'OrderDetail', params: { orderId } });
    },
    [navigation]
  );

  const handleAccept = useCallback(
    (order: Order) => {
      if (!effectiveCanClaim) {
        handleSetupRequired();
        return;
      }
      if (!locationCanClaim) {
        handleLocationBlocked();
        return;
      }
      void handleClaimPress(order);
    },
    [
      effectiveCanClaim,
      locationCanClaim,
      handleClaimPress,
      handleLocationBlocked,
      handleSetupRequired,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCardCompact
        order={item}
        onAccept={() => handleAccept(item)}
        onViewDetails={() => goToOrderDetail(item.id)}
        isBusy={claimingId === item.id}
        claimEnabled={effectiveCanClaim}
        acceptLabel={effectiveCanClaim ? undefined : claimBlockedLabel}
      />
    ),
    [claimBlockedLabel, claimingId, effectiveCanClaim, goToOrderDetail, handleAccept]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.pageBackground }]} edges={[]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <View style={styles.headerRow}>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
            {t('agent.openOrders.available', 'Available Orders')}
          </Text>
          <View style={styles.headerActions}>
            <OrderViewToggle mode={viewMode} onToggle={setViewMode} />
            <Pressable
              onPress={() => setShowSearch((v) => !v)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: showSearch ? colors.primaryTint : 'transparent',
                  borderRadius: borderRadius.sm,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={showSearch ? 'magnify-close' : 'magnify'}
                size={22}
                color={showSearch ? colors.primary.main : colors.text.secondary}
              />
            </Pressable>
            <Pressable
              onPress={() => void refetch()}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <MaterialCommunityIcons name="refresh" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>
        </View>
        {openOrders.length > 0 && (
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('agent.openOrders.ordersAvailable', '{{count}} order available', {
              count: openOrders.length,
              defaultValue_plural: '{{count}} orders available',
            })}
          </Text>
        )}
      </View>

      {/* Search bar */}
      {showSearch && (
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: borderRadius.md,
              marginHorizontal: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={colors.text.secondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder={t('orders.searchPlaceholder', 'Search order #, business, client...')}
            placeholderTextColor={colors.text.disabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.text.secondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Banners */}
      {agentStatus === 'suspended' ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="error"
          icon="account-cancel-outline"
          message={t('agent.suspendedBanner', 'Your account is suspended. Contact support.')}
        />
      ) : null}

      {effectiveCanClaim && !locationCanClaim && agentStatus !== 'suspended' ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="warning"
          icon="map-marker-off-outline"
          message={t('agent.locationTracking.claimRestrictedNotice', 'Enable location to claim orders.')}
          actionLabel={t('agent.locationTracking.openSettings', 'Enable location')}
          onAction={handleLocationBlocked}
        />
      ) : null}

      {!verificationLoading &&
      agentStatus !== 'suspended' &&
      !effectiveCanClaim &&
      isStripeRail &&
      !stripeReady ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="info"
          icon={sortedOrders.length > 0 ? 'eye-outline' : 'information-outline'}
          message={
            connectStatus?.connected
              ? t(
                  'agent.openOrders.stripeUnderReview',
                  'Your Stripe account is being reviewed. Complete setup to claim deliveries.'
                )
              : sortedOrders.length > 0
                ? t(
                    'agent.openOrders.previewBanner',
                    'These deliveries are available in your country. Complete verification to claim them.'
                  )
                : t(
                    'agent.openOrders.connectStripeToGetVerified',
                    'Connect your Stripe account to get verified and start claiming deliveries.'
                  )
          }
          actionLabel={
            connectStatus?.connected
              ? t('agent.continueStripeSetup', 'Continue setup')
              : t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim')
          }
          actionLoading={stripeActionLoading}
          onAction={() => void startOnboarding()}
        />
      ) : null}

      {!verificationLoading && agentStatus !== 'suspended' && !effectiveCanClaim && needsIdUpload ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="warning"
          icon={sortedOrders.length > 0 ? 'eye-outline' : 'card-account-details-outline'}
          message={
            idRejected
              ? t(
                  'agent.openOrders.idRejectedBanner',
                  'Your identification document was rejected. Please upload a new valid government ID (driver’s license, passport, or national ID) to continue.'
                )
              : sortedOrders.length > 0
                ? t(
                    'agent.openOrders.previewUploadId',
                    'These deliveries are available in your country. Upload a valid government ID (driver’s license, passport, or national ID) to get verified and claim them.'
                  )
                : t(
                    'agent.openOrders.uploadIdToGetVerified',
                    'Upload a valid government ID (driver’s license, passport, or national ID) to get verified and start claiming deliveries.'
                  )
          }
          actionLabel={
            idRejected
              ? t('agent.openOrders.idRejectedCta', 'Re-upload ID')
              : t('agent.openOrders.goToDocuments', 'Go to Documents')
          }
          onAction={() => navigation.navigate('Documents')}
        />
      ) : null}

      {!verificationLoading &&
      agentStatus !== 'suspended' &&
      !effectiveCanClaim &&
      idVerificationPending ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="info"
          icon="clock-outline"
          message={t(
            'agent.openOrders.accountUnderReview',
            'We received your identification document and it is pending approval. You can claim deliveries once a reviewer verifies your account.'
          )}
          actionLabel={t('agent.openOrders.viewDocuments', 'View documents')}
          onAction={() => navigation.navigate('Documents')}
        />
      ) : null}

      {/* Orders list / map */}
      {viewMode === 'map' ? (
        <OrderMapView
          orders={sortedOrders}
          onAccept={handleAccept}
          onViewDetails={goToOrderDetail}
          busyOrderId={claimingId}
          refreshing={loading}
          onRefresh={() => void refetch()}
          contentBottomPadding={tabScrollBottomPad}
          claimEnabled={effectiveCanClaim}
          claimBlockedLabel={claimBlockedLabel}
        />
      ) : (
      <FlatList
        data={sortedOrders}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: tabScrollBottomPad }}
        alwaysBounceVertical={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
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
                {t('common.listLoadError', 'Unable to load orders. Pull to refresh.')}
              </Text>
              <Pressable onPress={() => void refetch()} style={{ padding: 8 }}>
                <Text variant="labelMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
                  {t('common.retry', 'Retry')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="package-variant-closed" size={56} color={colors.text.disabled} />
              <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.text.primary }]}>
                {t('agent.openOrders.noOrdersFound', 'No orders available')}
              </Text>
              <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.text.secondary }]}>
                {t('agent.home.checkBackSoon', 'Pull to refresh to check for new orders')}
              </Text>
            </View>
          )
        }
      />
      )}

      {/* Dialogs */}
      <AgentClaimConfirmDialog
        visible={!!claimConfirm}
        order={claimConfirm?.order ?? null}
        holdAmount={claimConfirm?.holdAmount ?? 0}
        onDismiss={() => setClaimConfirm(null)}
        onConfirm={() => {
          if (!claimConfirm) return;
          const o = claimConfirm.order;
          setClaimConfirm(null);
          void confirmClaimOrder(o);
        }}
      />
      <ClaimTopupFormDialog
        visible={!!topupModalOrderId}
        order={topupModalOrderId ? openOrders.find((o) => o.id === topupModalOrderId) ?? null : null}
        phone={topupPhone}
        onChangePhone={setTopupPhone}
        onDismiss={closeTopupModal}
        onConfirm={(e164) => void onConfirmClaimWithTopup(e164)}
        confirming={!!topupModalOrderId && claimingId === topupModalOrderId}
      />
      <SimpleMessageDialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        dismissLabel={t('common.ok', { defaultValue: 'OK' })}
        onDismiss={() => setInfoDialog(null)}
      />
      <ActionLoadingDialog
        visible={!!claimingId || disclosurePermissionLoading}
        action={claimingId ? 'claim' : 'generic_update'}
        message={claimingId ? t('agent.claimOrder.processing', 'Claiming order…') : t('agent.locationTracking.disclosureProcessing', 'Setting up location…')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: '700', flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  banner: { marginBottom: 8 },
  list: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { textAlign: 'center', fontWeight: '700' },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
