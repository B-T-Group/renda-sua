import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AgentContractBanner } from '../../components/agent/AgentContractBanner';
import { useOpenOrders } from '../../hooks/useOpenOrders';
import { useAgentVerificationStatus } from '../../hooks/useAgentVerificationStatus';
import { useStripeConnect } from '../../hooks/useStripeConnect';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import type { Order } from '../../types/agent';
import { clientDisplayName } from '../../utils/orderCardHelpers';
import { compareOpenOrdersForAgent } from '../../utils/agentOpenOrderCard';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { SimpleMessageDialog } from '../../components/dialogs/SimpleMessageDialog';
import { useOpenOrderClaim } from '../../hooks/useOpenOrderClaim';
import { useDedicatedStoreLocationIds } from '../../hooks/useDedicatedStoreLocationIds';
import { OrderCardCompact } from '../../components/agent/OrderCardCompact';
import { OrderMapView } from '../../components/agent/OrderMapView';
import { OrderViewToggle } from '../../components/agent/OrderViewToggle';
import type { OrderViewMode } from '../../components/agent/OrderViewToggle';
import {
  agentClaimEnabled,
  agentIdVerificationPending,
  agentNeedsContract,
  agentNeedsIdUpload,
  agentNeedsMomoSetup,
} from '../../utils/agentClaimSetupGate';
import { useAgentContractStatus } from '../../hooks/useAgentContractStatus';

export default function OpenOrdersScreen() {
  const { t } = useTranslation();
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
  const contractStatus = useAgentContractStatus();
  const needsContract = Boolean(
    contractStatus && agentNeedsContract(contractStatus)
  );
  const effectiveCanClaim = agentClaimEnabled({
    ordersCanClaim,
    stripeBypass: isStripeRail && stripeReady,
    contract: contractStatus,
  });

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

  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<OrderViewMode>('list');
  const dedicatedLocationIds = useDedicatedStoreLocationIds();
  const claim = useOpenOrderClaim({
    orders: openOrders,
    refetch,
    claimOrder,
    claimOrderWithTopup,
    isStripeRail,
  });

  useFocusEffect(
    useCallback(() => {
      void refetchVerification();
      void refetch();
    }, [refetchVerification, refetch])
  );

  const idVerificationPending = agentIdVerificationPending({
    isStripeRail,
    isVerified,
    idDocumentStatus,
  });
  const needsIdUpload = agentNeedsIdUpload({
    isStripeRail,
    isVerified,
    idDocumentStatus,
  });
  const needsMomoSetup = agentNeedsMomoSetup({
    isStripeRail,
    isVerified,
    idDocumentStatus,
  });
  const idRejected = !isStripeRail && !isVerified && idDocumentStatus === 'rejected';

  const claimBlockedLabel = useMemo(() => {
    if (needsContract) {
      return t('agentContract.review', 'Review agreement');
    }
    if (isStripeRail) {
      return t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim');
    }
    if (idVerificationPending) {
      return t('agent.openOrders.idPendingCta', 'Pending ID approval');
    }
    if (idRejected) {
      return t('agent.openOrders.idRejectedCta', 'Re-upload ID');
    }
    if (needsMomoSetup) {
      return t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim');
    }
    return t('agent.openOrders.uploadIdToClaim', 'Upload ID to claim');
  }, [idRejected, idVerificationPending, isStripeRail, needsContract, needsMomoSetup, t]);

  const goToMomoSetup = useCallback(() => {
    navigation.navigate('MobilePaymentPhones');
  }, [navigation]);

  const handleSetupRequired = useCallback(() => {
    if (needsContract) {
      navigation.navigate('AgentAgreement');
      return;
    }
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
    if (needsMomoSetup) {
      goToMomoSetup();
      return;
    }
    navigation.navigate('Documents');
  }, [
    goToMomoSetup,
    idVerificationPending,
    isStripeRail,
    navigation,
    needsContract,
    needsMomoSetup,
    startOnboarding,
    stripeActionLoading,
    t,
  ]);

  const handleAccept = useCallback(
    (order: Order) => {
      if (!effectiveCanClaim) {
        handleSetupRequired();
        return;
      }
      void claim.startClaim(order);
    },
    [claim, effectiveCanClaim, handleSetupRequired]
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
    () =>
      filteredOrders
        .filter((o) => o.current_status === 'ready_for_pickup')
        .sort((a, b) => compareOpenOrdersForAgent(a, b, dedicatedLocationIds)),
    [dedicatedLocationIds, filteredOrders]
  );

  const goToOrderDetail = useCallback(
    (orderId: string) => {
      (navigation as any).navigate('Orders', { screen: 'OrderDetail', params: { orderId } });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCardCompact
        order={item}
        onAccept={() => handleAccept(item)}
        onViewDetails={() => goToOrderDetail(item.id)}
        isBusy={claim.claimingId === item.id}
        claimEnabled={effectiveCanClaim}
        acceptLabel={effectiveCanClaim ? undefined : claimBlockedLabel}
        dedicatedLocationIds={dedicatedLocationIds}
      />
    ),
    [claim.claimingId, claimBlockedLabel, effectiveCanClaim, goToOrderDetail, handleAccept]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.pageBackground }]} edges={[]}>
      <AgentContractBanner />
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

      {effectiveCanClaim && !claim.locationCanClaim && agentStatus !== 'suspended' ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="warning"
          icon="map-marker-off-outline"
          message={t('agent.locationTracking.claimRestrictedNotice', 'Enable location to claim orders.')}
          actionLabel={t('agent.locationTracking.openSettings', 'Enable location')}
          onAction={claim.onLocationBlocked}
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
      needsMomoSetup ? (
        <NoticeBanner
          style={[styles.banner, { marginHorizontal: spacing.md }]}
          tone="warning"
          icon="cellphone-check"
          message={t(
            'agent.openOrders.momoSetupBanner',
            'Your ID is approved. Verify your mobile money number to finish setup and claim deliveries.'
          )}
          actionLabel={t(
            'agent.openOrders.verifyMobileMoneyToFinish',
            'Verify mobile money to finish'
          )}
          onAction={goToMomoSetup}
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
          busyOrderId={claim.claimingId}
          refreshing={loading}
          onRefresh={() => void refetch()}
          contentBottomPadding={tabScrollBottomPad}
          claimEnabled={effectiveCanClaim}
          claimBlockedLabel={claimBlockedLabel}
          dedicatedLocationIds={dedicatedLocationIds}
        />
      ) : (
      <FlashList
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

      {claim.dialogs}
      <SimpleMessageDialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        dismissLabel={t('common.ok', { defaultValue: 'OK' })}
        onDismiss={() => setInfoDialog(null)}
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
