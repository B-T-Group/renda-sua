import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useAgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';
import { useAgentXafWallet } from '../../hooks/useAgentXafWallet';
import { resolveDisplayCurrency, useUserCurrency } from '../../hooks/useUserCurrency';
import { useOpenOrders } from '../../hooks/useOpenOrders';
import { useAgentOrders } from '../../hooks/useAgentOrders';
import { useAgentVerificationStatus } from '../../hooks/useAgentVerificationStatus';
import { useHoldPercentage } from '../../hooks/useHoldPercentage';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { shadows } from '../../theme/shadows';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { ListCardSkeleton } from '../../components/common/DashboardSkeleton';
import { SkeletonBone } from '../../components/common/SkeletonBone';
import { AgentReferredBusinessesHero } from '../../components/agent/AgentReferredBusinessesHero';
import { ReferralPayoutSnapshot } from '../../components/common/ReferralPayoutSnapshot';
import { AgentWithdrawDialog } from '../../components/dialogs/AgentWithdrawDialog';
import { AgentAccountTransactionsDialog } from '../../components/dialogs/AgentAccountTransactionsDialog';
import { SimpleMessageDialog } from '../../components/dialogs/SimpleMessageDialog';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import { OrderCardCompact } from '../../components/agent/OrderCardCompact';
import { OrderCardActive } from '../../components/agent/OrderCardCompact';
import { statusToPrimaryAction } from '../../components/agent/DeliveryStatusIndicator';
import { ActionsNeededSection } from '../../components/common/ActionsNeededSection';
import { NotificationBellButton } from '../../components/common/NotificationBellButton';
import { TintedHeaderBlock } from '../../components/common/TintedHeaderBlock';
import { AgentActivationChecklist } from '../../components/agent/AgentActivationChecklist';
import { FeatureCard } from '../../components/common/FeatureCard';
import { AssistantHomeEntry } from '../../components/common/AssistantHomeEntry';
import { useActionsNeeded } from '../../hooks/useActionsNeeded';
import type { AppNavScreen } from '../../navigation/AppNavigator';
import type { RootStackParamList as AgentRootStackParamList } from '../../navigation/AgentRootNavigator';
import { useNotifications } from '../../hooks/useNotifications';
import { formatCurrency } from '../../utils/formatters';
import { resolveWithdrawDefaultPhone } from '../../utils/resolveWithdrawDefaultPhone';
import { useAgentReferredBusinesses } from '../../hooks/useAgentReferredBusinesses';
import { useReferralProjectedPayout } from '../../hooks/useReferralProjectedPayout';
import { useAgentFocus } from '../../hooks/useAgentFocus';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { EarnDeliveringIllustration } from '../../components/illustrations/EarnDeliveringIllustration';
import { ProfilePhotoTipIllustration } from '../../components/illustrations/ProfilePhotoTipIllustration';
import { useProfileMe } from '../../hooks/useProfileMe';

const MAX_HOME_ORDERS = 3;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { auth } = useStore();
  const navigation = useNavigation<{
    navigate: (name: AppNavScreen) => void;
    getParent: () => { navigate: (name: AppNavScreen) => void } | undefined;
  }>();

  const { showDelivery, showCommercial } = useAgentFocus(true);
  const { me, refetch: refetchProfile } = useProfileMe(!!auth.isAuthenticated);
  const { summary, loading: earningsLoading, refetch: refetchEarnings } = useAgentEarningsSummary(true);
  const {
    count: referredBusinessCount,
    loading: referredLoading,
    refetch: refetchReferred,
  } = useAgentReferredBusinesses(showCommercial);
  const { projection: referralPayout, refresh: refetchReferralPayout } =
    useReferralProjectedPayout('agent', !!auth.isAuthenticated);
  const { currency: meCurrency } = useUserCurrency(!!auth.isAuthenticated);
  const { openOrders, loading: openOrdersLoading, refetch: refetchOpenOrders, canClaim: ordersCanClaim } = useOpenOrders();
  const {
    isVerified,
    idDocumentStatus,
    loading: verificationLoading,
    refetch: refetchVerification,
  } = useAgentVerificationStatus();
  const { categorized: agentOrdersCategorized, refetch: refetchAgentOrders } = useAgentOrders();
  const { holdPercentage, refetch: refetchHold } = useHoldPercentage(true);
  const {
    wallet: xafWallet,
    allAccounts: walletAllAccounts,
    transactions: walletTransactions,
    availableBalance: walletAvailable,
    currency: walletCurrency,
    loading: walletLoading,
    refetch: refetchWallet,
    refetchStripe,
    withdrawFromAccount,
    stripeWithdrawFromAccount,
    isStripeRail: walletIsStripeRail,
    stripeConnected: walletStripeConnected,
    stripeReady: walletStripeReady,
    startStripeOnboarding,
    stripeActionLoading,
  } = useAgentXafWallet(!!auth.isAuthenticated, meCurrency);

  const { hasVerifiedPhone, phones, fetchPhones } = useMobilePaymentPhones(!walletIsStripeRail);

  const displayCurrency = resolveDisplayCurrency(
    walletCurrency,
    meCurrency,
    summary?.currency
  );

  const tabScrollBottomPad = useMainTabContentBottomPadding(24);

  const [refreshing, setRefreshing] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txDialogLoading, setTxDialogLoading] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [walletSnack, setWalletSnack] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  const { items: actionsNeededItems, refresh: refreshActionsNeeded, dismissAll } =
    useActionsNeeded('agent');
  const { unreadCount: notifUnreadCount } = useNotifications();

  const idVerificationPending =
    !walletIsStripeRail && !isVerified && idDocumentStatus === 'pending';
  const needsIdUpload =
    !walletIsStripeRail &&
    !isVerified &&
    (idDocumentStatus === 'missing' || idDocumentStatus === 'rejected');
  const idRejected =
    !walletIsStripeRail && !isVerified && idDocumentStatus === 'rejected';
  const showVerificationBanner =
    !verificationLoading &&
    !ordersCanClaim &&
    !(walletIsStripeRail && walletStripeReady);

  useFocusEffect(
    useCallback(() => {
      void refetchVerification();
      void refetchProfile({ silent: true });
    }, [refetchVerification, refetchProfile])
  );

  // After Stripe Connect becomes ready, backend sets agent.is_verified; refresh
  // open orders so canClaim flips and the preview banner can disappear.
  const prevStripeReadyRef = useRef(walletStripeReady);
  useEffect(() => {
    const wasReady = prevStripeReadyRef.current === true;
    prevStripeReadyRef.current = walletStripeReady;
    if (walletStripeReady && !wasReady) {
      void refetchOpenOrders();
      void refetchVerification();
    }
  }, [walletStripeReady, refetchOpenOrders, refetchVerification]);

  const activeOrders = agentOrdersCategorized.active;
  const previewOpenOrders = openOrders.slice(0, MAX_HOME_ORDERS);
  const previewActiveOrders = activeOrders.slice(0, MAX_HOME_ORDERS);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchEarnings(),
        refetchOpenOrders(),
        refetchAgentOrders(),
        refetchHold(),
        refetchWallet(),
        refetchStripe(),
        refetchReferred(),
        refetchReferralPayout(),
        refetchVerification(),
        refetchProfile(),
        fetchPhones(),
        refreshActionsNeeded(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchEarnings,
    refetchOpenOrders,
    refetchAgentOrders,
    refetchHold,
    refetchWallet,
    refetchStripe,
    refetchReferred,
    refetchReferralPayout,
    refetchVerification,
    refetchProfile,
    fetchPhones,
    refreshActionsNeeded,
  ]);

  const goTo = useCallback(
    (route: AppNavScreen) => {
      const root = navigation.getParent();
      if (
        root &&
        (route === 'AgentLocationTracking' ||
          route === 'AgentAccounts' ||
          route === 'Earnings' ||
          route === 'AgentBusinessReferral' ||
          route === 'Documents' ||
          route === 'Profile' ||
          route === 'AssistantChat')
      ) {
        root.navigate(route);
        return;
      }
      navigation.navigate(route);
    },
    [navigation]
  );

  const openTransactionsDialog = useCallback(async () => {
    setTxDialogOpen(true);
    setTxDialogLoading(true);
    try {
      await refetchWallet();
    } finally {
      setTxDialogLoading(false);
    }
  }, [refetchWallet]);

  const handleWithdrawConfirm = useCallback(
    async (amount: number, phoneE164?: string, pin?: string) => {
      setWithdrawSubmitting(true);
      try {
        if (!xafWallet) {
          return { success: false as const, message: 'No wallet' };
        }
        const res = walletIsStripeRail
          ? await stripeWithdrawFromAccount(xafWallet, amount)
          : await withdrawFromAccount(xafWallet, amount, phoneE164, pin);
        if (res.success) {
          await refetchWallet();
          setWalletSnack(t('accounts.withdrawSuccess', 'Withdrawal started. Your balance will update when it completes.'));
          return { success: true as const };
        }
        return { success: false as const, message: res.message };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : undefined;
        return { success: false as const, message };
      } finally {
        setWithdrawSubmitting(false);
      }
    },
    [
      xafWallet,
      walletIsStripeRail,
      stripeWithdrawFromAccount,
      withdrawFromAccount,
      refetchWallet,
      t,
    ]
  );

  const withdrawDisabled = walletLoading || walletAvailable <= 0 || (walletIsStripeRail && !walletStripeReady);

  const defaultWithdrawPhone = resolveWithdrawDefaultPhone({
    isLocationAccount: false,
    userPhone: me?.phone_number,
    authPhone: auth.user?.phoneNumber,
  });

  const goToOrderDetail = useCallback(
    (orderId: string) => {
      (navigation as any).navigate('Orders', { screen: 'OrderDetail', params: { orderId } });
    },
    [navigation]
  );

  const goToAvailableOrders = useCallback(() => {
    (navigation as any).navigate('OpenOrders');
  }, [navigation]);

  const goToDocuments = useCallback(() => {
    goTo('Documents');
  }, [goTo]);

  const handlePreviewOrderAction = useCallback(() => {
    if (!ordersCanClaim && walletIsStripeRail && !walletStripeReady) {
      void startStripeOnboarding();
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
    if (needsIdUpload) {
      goToDocuments();
      return;
    }
    goToAvailableOrders();
  }, [
    goToAvailableOrders,
    goToDocuments,
    idVerificationPending,
    needsIdUpload,
    ordersCanClaim,
    startStripeOnboarding,
    t,
    walletIsStripeRail,
    walletStripeReady,
  ]);

  const homeClaimEnabled = ordersCanClaim || (walletIsStripeRail && walletStripeReady);
  const claimBlockedLabel = !homeClaimEnabled
    ? walletIsStripeRail
      ? t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim')
      : idVerificationPending
        ? t('agent.openOrders.idPendingCta', 'Pending ID approval')
        : idRejected
          ? t('agent.openOrders.idRejectedCta', 'Re-upload ID')
          : t('agent.openOrders.uploadIdToClaim', 'Upload ID to claim')
    : undefined;

  const goToActiveOrders = useCallback(() => {
    (navigation as any).navigate('Orders');
  }, [navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={[]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabScrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
          />
        }
      >
        <TintedHeaderBlock
          style={{ marginHorizontal: 0 }}
          contentStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}
        >
          <View style={styles.header}>
            <Text variant="headlineSmall" style={[styles.pageTitle, { color: colors.text.primary }]}>
              {t('nav.home', 'Home')}
            </Text>
            <NotificationBellButton
              unreadCount={notifUnreadCount}
              onPress={() => (navigation as any).navigate('NotificationsCenter')}
            />
          </View>
          <ActionsNeededSection
            items={actionsNeededItems}
            onMarkAllRead={() => void dismissAll()}
          />
        </TintedHeaderBlock>

        <View style={{ paddingHorizontal: spacing.md }}>
          <AssistantHomeEntry
            onPress={() => goTo('AssistantChat')}
            style={{ marginBottom: spacing.md }}
          />
          <ReferralPayoutSnapshot
            availableBalance={walletAvailable}
            balanceCurrency={displayCurrency}
            projectedAmount={referralPayout?.projectedAmount ?? 0}
            projectedCurrency={referralPayout?.currency ?? displayCurrency}
            onOpenWallet={() => goTo('AgentAccounts')}
          />
          {!me?.profile_picture_url && !auth.displayProfilePhotoUri ? (
            <FeatureCard
              title={t('ftue.education.agentPhotoTipTitle', 'Tip: add a profile photo')}
              message={t(
                'ftue.education.agentPhotoTipMessage',
                'A clear photo helps clients trust who is picking up and delivering their order.'
              )}
              illustration={<ProfilePhotoTipIllustration size={96} />}
              actionLabel={t('ftue.education.agentPhotoTipAction', 'Add photo')}
              onAction={() => goTo('Profile')}
            />
          ) : null}
          {showDelivery ? (
            <>
              <AgentActivationChecklist
                hasCompletedDelivery={
                  (agentOrdersCategorized?.completed?.length ?? 0) > 0
                }
                onRefreshOrders={() => refetchAgentOrders()}
              />
              <FeatureCard
                title={t('ftue.education.agentTipTitle', 'Tip: stay nearby')}
                message={t(
                  'ftue.education.agentTipMessage',
                  'Going available near busy stores helps you get offers faster.'
                )}
                illustration={<EarnDeliveringIllustration size={96} />}
              />
            </>
          ) : null}
          {showCommercial ? (
            <AgentReferredBusinessesHero
              count={referredBusinessCount}
              loading={referredLoading && referredBusinessCount == null}
              onPress={() => goTo('AgentBusinessReferral')}
            />
          ) : null}
        </View>

        {/* Stripe setup banner */}
        {walletIsStripeRail && !walletStripeReady ? (
          <NoticeBanner
            style={[styles.banner, { marginHorizontal: spacing.md }]}
            tone="info"
            icon="wallet-outline"
            message={
              walletStripeConnected
                ? t('agent.stripeUnderReviewBanner', 'Your Stripe account is under review.')
                : t('agent.connectStripeBanner', 'Connect Stripe to start receiving deliveries.')
            }
            actionLabel={
              walletStripeConnected
                ? t('agent.continueStripeSetup', 'Continue setup')
                : t('agent.setUpPayouts', 'Set up payouts')
            }
            actionLoading={stripeActionLoading}
            onAction={() => {
              void startStripeOnboarding();
            }}
          />
        ) : null}

        {!walletIsStripeRail && !hasVerifiedPhone ? (
          <NoticeBanner
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}
            tone="warning"
            icon="cellphone-check"
            message={t(
              'mobilePaymentPhone.agentDashboardCta',
              'Verify your mobile money number to receive commission payouts.'
            )}
            actionLabel={t('mobilePaymentPhone.verifyCta', 'Verify mobile money number')}
            onAction={() => setPhoneModalOpen(true)}
          />
        ) : null}

        {showDelivery && showVerificationBanner && needsIdUpload ? (
          <NoticeBanner
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}
            tone="warning"
            icon={previewOpenOrders.length > 0 ? 'eye-outline' : 'card-account-details-outline'}
            message={
              idRejected
                ? t(
                    'agent.openOrders.idRejectedBanner',
                    'Your identification document was rejected. Please upload a new valid government ID (driver’s license, passport, or national ID) to continue.'
                  )
                : previewOpenOrders.length > 0
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
            onAction={goToDocuments}
          />
        ) : null}

        {showDelivery && showVerificationBanner && idVerificationPending ? (
          <NoticeBanner
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}
            tone="info"
            icon="clock-outline"
            message={t(
              'agent.openOrders.accountUnderReview',
              'We received your identification document and it is pending approval. You can claim deliveries once a reviewer verifies your account.'
            )}
            actionLabel={t('agent.openOrders.viewDocuments', 'View documents')}
            onAction={goToDocuments}
          />
        ) : null}

        {showDelivery ? (
        <>
        {/* ── SECTION 1: Available Deliveries ── */}
        <View style={[styles.section, { paddingHorizontal: spacing.md }]}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {t('agent.openOrders.available', 'Available Deliveries')}
            </Text>
            {openOrders.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.full }]}>
                <Text variant="labelSmall" style={{ color: colors.primary.main, fontWeight: '700' }}>
                  {openOrders.length}
                </Text>
              </View>
            )}
          </View>
        </View>

        {openOrdersLoading && openOrders.length === 0 ? (
          <View style={{ marginHorizontal: spacing.md }}>
            <ListCardSkeleton count={2} />
          </View>
        ) : previewOpenOrders.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                borderColor: colors.divider,
                marginHorizontal: spacing.md,
              },
            ]}
          >
            <MaterialCommunityIcons name="package-variant-closed" size={36} color={colors.text.disabled} />
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.text.secondary }]}>
              {t('agent.openOrders.noOrdersFound', 'No orders available right now')}
            </Text>
            <Text variant="bodySmall" style={[styles.emptySubtext, { color: colors.text.disabled }]}>
              {t('agent.home.checkBackSoon', 'Pull to refresh or check the Available tab')}
            </Text>
          </View>
        ) : (
          <>
            {previewOpenOrders.map((order) => (
              <OrderCardCompact
                key={order.id}
                order={order}
                onAccept={handlePreviewOrderAction}
                onViewDetails={() => goToOrderDetail(order.id)}
                claimEnabled={homeClaimEnabled}
                acceptLabel={claimBlockedLabel}
              />
            ))}
            {openOrders.length > MAX_HOME_ORDERS && (
              <Pressable
                onPress={goToAvailableOrders}
                style={({ pressed }) => [
                  styles.viewAllRow,
                  { marginHorizontal: spacing.md, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text variant="labelMedium" style={[styles.viewAllText, { color: colors.primary.main }]}>
                  {t('agent.home.viewAllAvailable', 'View all {{count}} available', { count: openOrders.length })}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary.main} />
              </Pressable>
            )}
            {openOrders.length > 0 && openOrders.length <= MAX_HOME_ORDERS && (
              <Pressable
                onPress={goToAvailableOrders}
                style={({ pressed }) => [
                  styles.viewAllRow,
                  { marginHorizontal: spacing.md, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text variant="labelMedium" style={[styles.viewAllText, { color: colors.primary.main }]}>
                  {t('agent.openOrders.title', 'View Available Orders')}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary.main} />
              </Pressable>
            )}
          </>
        )}

        {/* ── SECTION 2: Active Orders preview ── */}
        {previewActiveOrders.length > 0 && (
          <>
            <View style={[styles.section, { paddingHorizontal: spacing.md, marginTop: spacing.sm }]}>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  {t('agent.activeOrders', 'Active Orders')}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.full }]}>
                  <Text variant="labelSmall" style={{ color: colors.primary.main, fontWeight: '700' }}>
                    {activeOrders.length}
                  </Text>
                </View>
              </View>
            </View>
            {previewActiveOrders.map((order) => {
              const primaryLabel = statusToPrimaryAction(order.current_status, t) ?? t('common.details', 'Details');
              return (
                <OrderCardActive
                  key={order.id}
                  order={order}
                  primaryActionLabel={primaryLabel}
                  onPrimaryAction={() => goToOrderDetail(order.id)}
                  onViewDetails={() => goToOrderDetail(order.id)}
                />
              );
            })}
            {activeOrders.length > MAX_HOME_ORDERS && (
              <Pressable
                onPress={goToActiveOrders}
                style={({ pressed }) => [
                  styles.viewAllRow,
                  { marginHorizontal: spacing.md, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text variant="labelMedium" style={[styles.viewAllText, { color: colors.primary.main }]}>
                  {t('agent.home.viewAllActive', 'View all {{count}} active', { count: activeOrders.length })}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary.main} />
              </Pressable>
            )}
          </>
        )}
        </>
        ) : null}

        {/* ── SECTION 3: Today's Earnings ── */}
        <View style={[styles.section, { paddingHorizontal: spacing.md, marginTop: spacing.sm }]}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {t('agent.earnings.todaysEarnings', "Today's Earnings")}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.earningsCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              borderColor: colors.divider,
              marginHorizontal: spacing.md,
            },
          ]}
        >
          {earningsLoading && !summary ? (
            <View style={{ gap: spacing.sm }}>
              <SkeletonBone height={36} width="55%" />
              <SkeletonBone height={14} width="40%" />
              <SkeletonBone height={40} width="100%" borderRadius={borderRadius.sm} />
            </View>
          ) : (
            <>
              <View style={styles.earningsRow}>
                <View style={styles.earningsMain}>
                  <Text variant="displaySmall" style={[styles.earningsAmount, { color: colors.text.primary }]}>
                    {summary ? formatCurrency(summary.todayEarnings, displayCurrency) : '—'}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {summary
                      ? t('agent.home.deliveryCount', '{{count}} delivery', {
                          count: summary.todayDeliveryCount,
                          defaultValue_plural: '{{count}} deliveries',
                        })
                      : t('common.loading', 'Loading...')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => goTo('Earnings')}
                  style={({ pressed }) => [
                    styles.earningsViewBtn,
                    {
                      backgroundColor: colors.primaryTint,
                      borderRadius: borderRadius.sm,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text variant="labelMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
                    {t('dashboard.viewAll', 'View All')}
                  </Text>
                </Pressable>
              </View>
              {/* Quick stats */}
              {summary && (
                <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
                  <View style={styles.statBlock}>
                    <Text variant="labelSmall" style={{ color: colors.text.disabled, letterSpacing: 0.5 }}>
                      {t('agent.earnings.avgCommission', 'Avg. commission').toUpperCase()}
                    </Text>
                    <Text variant="titleSmall" style={[styles.statValue, { color: colors.text.primary }]}>
                      {summary.todayDeliveryCount > 0
                        ? formatCurrency(
                            summary.todayEarnings / summary.todayDeliveryCount,
                            displayCurrency
                          )
                        : '—'}
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statBlock}>
                    <Text variant="labelSmall" style={{ color: colors.text.disabled, letterSpacing: 0.5 }}>
                      {t('agent.earnings.active', 'ACTIVE').toUpperCase()}
                    </Text>
                    <Text variant="titleSmall" style={[styles.statValue, { color: colors.text.primary }]}>
                      {summary.activeOrderCount}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── SECTION 4: Wallet / Withdraw ── */}
        {(walletLoading || xafWallet) && (
          <>
            <View style={[styles.section, { paddingHorizontal: spacing.md, marginTop: spacing.sm }]}>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  {t('agent.accounts.navTitle', 'Wallet')}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.walletCard,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  borderColor: colors.divider,
                  marginHorizontal: spacing.md,
                },
              ]}
            >
              <View style={styles.walletBalanceRow}>
                <View>
                  <Text variant="labelSmall" style={{ color: colors.text.disabled, letterSpacing: 0.5 }}>
                    {t('dashboard.availableBalance', 'AVAILABLE BALANCE').toUpperCase()}
                  </Text>
                  {walletLoading ? (
                    <SkeletonBone height={32} width={120} style={{ marginTop: 4 }} />
                  ) : (
                    <Text variant="headlineMedium" style={[styles.walletBalance, { color: colors.text.primary }]}>
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: walletCurrency,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(walletAvailable)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.walletActions}>
                <Button
                  mode="contained"
                  onPress={() => setWithdrawOpen(true)}
                  disabled={withdrawDisabled}
                  icon="bank-transfer-out"
                  style={[styles.walletWithdrawBtn, { borderRadius: borderRadius.button }]}
                  labelStyle={{ fontWeight: '700' }}
                  contentStyle={{ height: 44 }}
                >
                  {t('dashboard.withdraw', 'Withdraw')}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => void openTransactionsDialog()}
                  icon="history"
                  style={[styles.walletTxBtn, { borderRadius: borderRadius.button }]}
                  labelStyle={{ fontWeight: '600' }}
                  contentStyle={{ height: 44 }}
                >
                  {t('accounts.viewTransactions', 'Transactions')}
                </Button>
              </View>
              {holdPercentage != null && holdPercentage > 0 && (
                <Text variant="bodySmall" style={[styles.holdNote, { color: colors.text.secondary }]}>
                  {t('agent.unverifiedHoldNote', 'Verify your account to reduce hold amounts.')} ({holdPercentage}%)
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <AgentWithdrawDialog
        visible={withdrawOpen}
        onDismiss={() => setWithdrawOpen(false)}
        onConfirm={handleWithdrawConfirm}
        availableBalance={walletAvailable}
        currency={displayCurrency}
        defaultPhone={defaultWithdrawPhone}
        submitting={withdrawSubmitting}
        mode={walletIsStripeRail ? 'stripe' : 'mobile_money'}
        accountId={xafWallet?.id}
      />
      <AgentAccountTransactionsDialog
        visible={txDialogOpen}
        onDismiss={() => setTxDialogOpen(false)}
        transactions={walletTransactions}
        loading={txDialogLoading}
        currency={displayCurrency}
        availableBalance={walletAvailable}
        accounts={walletAllAccounts}
      />
      <SimpleMessageDialog
        visible={infoDialog != null}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        dismissLabel={t('common.ok', 'OK')}
        onDismiss={() => setInfoDialog(null)}
      />
      <MobilePaymentPhoneVerifyModal
        visible={phoneModalOpen}
        mode={phones[0] ? 'verify' : 'add'}
        initialPhone={phones[0] ?? null}
        attachAgentOnSuccess
        onDismiss={() => setPhoneModalOpen(false)}
        onCompleted={() => {
          void fetchPhones();
          void refetchVerification();
          setPhoneModalOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: 8 },
  header: { paddingBottom: 4, paddingTop: 12 },
  pageTitle: { fontWeight: '700' },
  banner: { marginBottom: 12 },
  addressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  addressBannerText: { flex: 1, lineHeight: 18 },
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { fontWeight: '700' },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  placeholder: {
    padding: 24,
    alignItems: 'center',
  },
  emptyState: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  emptyText: { textAlign: 'center', fontWeight: '600' },
  emptySubtext: { textAlign: 'center', lineHeight: 18 },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  viewAllText: { fontWeight: '700' },
  earningsCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  earningsMain: { gap: 2 },
  earningsAmount: { fontWeight: '800', letterSpacing: -0.5 },
  earningsViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statBlock: { flex: 1, gap: 3 },
  statValue: { fontWeight: '700' },
  statDivider: { width: 1, height: 32, marginHorizontal: 16 },
  walletCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 14,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  walletBalance: { fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  walletActions: {
    flexDirection: 'row',
    gap: 10,
  },
  walletWithdrawBtn: { flex: 1 },
  walletTxBtn: { flex: 1 },
  holdNote: { lineHeight: 16 },
});
