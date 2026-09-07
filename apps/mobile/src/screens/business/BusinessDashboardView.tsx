import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useAgentXafWallet } from '../../hooks/useAgentXafWallet';
import { resolveDisplayCurrency, useUserCurrency } from '../../hooks/useUserCurrency';
import { useReferralProjectedPayout } from '../../hooks/useReferralProjectedPayout';
import { ReferralPayoutSnapshot } from '../../components/common/ReferralPayoutSnapshot';
import { BusinessModuleCard } from '../../components/business/BusinessModuleCard';
import { BusinessStoreReachCard } from '../../components/business/BusinessStoreReachCard';
import { BusinessCatalogHealthCard } from '../../components/business/BusinessCatalogHealthCard';
import { BusinessQuietHomeNextActionCard } from '../../components/business/BusinessQuietHomeNextActionCard';
import { BusinessMerchantTipCard } from '../../components/business/BusinessMerchantTipCard';
import { BusinessPreviewStoreCta } from '../../components/business/BusinessPreviewStoreCta';
import { BusinessGoLiveCelebration } from '../../components/business/BusinessGoLiveCelebration';
import { BusinessSetupChecklist } from '../../components/business/BusinessSetupChecklist';
import { BusinessStoreReadinessCard } from '../../components/business/BusinessStoreReadinessCard';
import { BusinessVerificationBanner } from '../../components/business/BusinessVerificationBanner';
import { BusinessReferralCodeCard } from '../../components/business/BusinessReferralCodeCard';
import { LaunchPromoBanner } from '../../components/business/LaunchPromoBanner';
import { MerchantStatusChip } from '../../components/business/MerchantStatusChip';
import { NotificationBellButton } from '../../components/common/NotificationBellButton';
import { AssistantIconButton } from '../../components/common/AssistantIconButton';
import { TintedHeaderBlock } from '../../components/common/TintedHeaderBlock';
import { DashboardSkeleton } from '../../components/common/DashboardSkeleton';
import { ActionsNeededSection } from '../../components/common/ActionsNeededSection';
import { ActiveOrdersCarousel } from '../../components/business/ActiveOrdersCarousel';
import { ActiveOrderCtaHost } from '../../components/business/ActiveOrderCtaHost';
import { MobilePaymentPhoneChooserSheet } from '../../components/dialogs/MobilePaymentPhoneChooserSheet';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import type { useBusinessDashboardScreen } from '../../hooks/business/useBusinessDashboardScreen';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Props = ReturnType<typeof useBusinessDashboardScreen> & {
  onOpenNotifications?: () => void;
  notificationsUnreadCount?: number;
  onDismissAllActions?: () => void;
};

export function BusinessDashboardView({
  loading,
  initialLoading,
  refreshing,
  error,
  deliveryModules,
  catalogModules,
  quietCatalogModules,
  exceptionModules,
  adminModules,
  setupMode,
  quietHomeMode,
  fulfillmentMode,
  mainInterest,
  hasAnyItem,
  showSetupPreviewStore,
  showPreviewStoreCta,
  totalProductViews,
  catalogHealth,
  quietNextAction,
  onCatalogHealthPrimary,
  onQuietNextAction,
  onQuietNextDismiss,
  onShareStorefront,
  onSetupSignAgreement,
  onSetupPayouts,
  onSetupUploadId,
  onSetupAddProduct,
  onSetupManageLocations,
  onSetupViewItems,
  onSetupRefresh,
  onOpenInsights,
  onPreviewStore,
  onRefresh,
  retry,
  verificationStatus,
  verificationLoading,
  onRefreshVerification,
  actionsNeededItems,
  onOpenNotifications,
  notificationsUnreadCount = 0,
  onDismissAllActions,
  mobilePaymentPhoneCtaVariant,
  chooserOpen,
  phones,
  verificationMethod,
  onDismissPhoneChooser,
  onSelectDashboardPhone,
  onVerifyChooserPhone,
  onAddDashboardPhone,
  phoneModalOpen,
  phoneModalMode,
  phoneModalInitial,
  onDismissMobilePaymentPhoneVerify,
  onMobilePaymentPhoneVerified,
  goLiveOpen,
  onDismissGoLive,
  onGoLivePreviewStore,
  onGoLiveAddProduct,
  readinessSteps,
  merchantTip,
  onReadinessStepPress,
  onMerchantTipAction,
  onMerchantTipDismiss,
  activeOrders,
  onOpenActiveOrder,
  onActiveOrderCta,
  activeOrderCtaOrder,
  activeOrderCtaRequestId,
  onActiveOrderCtaSuccess,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const { auth } = useStore();
  const { currency: meCurrency } = useUserCurrency(!!auth.isAuthenticated);
  const {
    availableBalance: walletAvailable,
    currency: walletCurrency,
    refetch: refetchWallet,
  } = useAgentXafWallet(!!auth.isAuthenticated, meCurrency);
  const { projection: referralPayout, refresh: refetchReferralPayout } =
    useReferralProjectedPayout('business', !!auth.isAuthenticated);
  const displayCurrency = resolveDisplayCurrency(
    walletCurrency,
    meCurrency,
    referralPayout?.currency
  );

  const [payoutRefreshing, setPayoutRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setPayoutRefreshing(true);
    try {
      await Promise.all([
        onRefresh(),
        refetchWallet(),
        refetchReferralPayout(),
      ]);
    } finally {
      setPayoutRefreshing(false);
    }
  }, [onRefresh, refetchWallet, refetchReferralPayout]);

  const showSkeleton =
    !error &&
    ((setupMode && !verificationStatus) || (!setupMode && initialLoading));

  const showWalletSnapshot =
    !showSkeleton &&
    ((walletAvailable ?? 0) > 0 ||
      (referralPayout?.projectedAmount ?? 0) > 0);

  const showQuietNextCard =
    quietHomeMode &&
    quietNextAction &&
    quietNextAction.id !== 'actions_needed';

  const showQuietActionsNeeded =
    quietHomeMode && quietNextAction?.id === 'actions_needed';

  const openAssistant = useCallback(() => {
    navigation.navigate('AssistantChat');
  }, [navigation]);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
          },
        ]}
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || payoutRefreshing}
            onRefresh={() => void handleRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
      >
        <TintedHeaderBlock style={{ marginHorizontal: -16 }} contentStyle={{ paddingHorizontal: 16 }}>
          <View style={styles.titleRow}>
            <Text
              variant="headlineSmall"
              style={{ color: colors.text.primary, flex: 1, minWidth: 0, marginRight: 8 }}
            >
              {t('business.tabs.dashboard', 'Dashboard')}
            </Text>
            <View style={styles.headerActions}>
              {verificationStatus ? (
                <MerchantStatusChip
                  lifecycle_status={verificationStatus.lifecycle_status}
                  can_accept_orders={verificationStatus.can_accept_orders}
                  is_storefront_visible={verificationStatus.is_storefront_visible}
                  is_verified={verificationStatus.is_verified}
                  style={styles.statusChip}
                />
              ) : null}
              <AssistantIconButton onPress={openAssistant} />
              {onOpenNotifications ? (
                <NotificationBellButton
                  unreadCount={notificationsUnreadCount}
                  onPress={onOpenNotifications}
                />
              ) : null}
            </View>
          </View>
        </TintedHeaderBlock>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={{ color: colors.error.main, marginBottom: 12 }}>
              {error}
            </Text>
            <Button mode="contained" onPress={() => void retry()}>
              Retry
            </Button>
          </View>
        ) : null}

        {showSkeleton ? <DashboardSkeleton variant="business" rows={4} /> : null}

        {/* —— Setup mode —— */}
        {!showSkeleton && setupMode && verificationStatus ? (
          <BusinessSetupChecklist
            status={verificationStatus}
            mainInterest={mainInterest}
            hasAnyItem={hasAnyItem}
            onSignAgreement={onSetupSignAgreement}
            onSetupPayouts={onSetupPayouts}
            onUploadId={onSetupUploadId}
            onAddProduct={onSetupAddProduct}
            onManageLocations={onSetupManageLocations}
            onViewItems={onSetupViewItems}
            onRefresh={onSetupRefresh}
          />
        ) : null}
        {setupMode ? (
          <BusinessPreviewStoreCta
            visible={showSetupPreviewStore && !error}
            onPress={onPreviewStore}
          />
        ) : null}

        {/* —— Fulfillment: active orders first —— */}
        {!showSkeleton && fulfillmentMode ? (
          <ActiveOrdersCarousel
            orders={activeOrders}
            onOpenOrder={onOpenActiveOrder}
            onPressCta={onActiveOrderCta}
          />
        ) : null}

        {/* —— Quiet / fulfillment operational pillars —— */}
        {!showSkeleton && !setupMode ? (
          <>
            <BusinessStoreReachCard
              productViews={totalProductViews}
              metricsLoading={
                initialLoading ||
                (loading && totalProductViews == null)
              }
              compact={fulfillmentMode}
              onShare={() => void onShareStorefront()}
              onPreview={onPreviewStore}
              onOpenInsights={onOpenInsights}
            />
            <BusinessCatalogHealthCard
              health={catalogHealth}
              compact={fulfillmentMode}
              onPrimary={onCatalogHealthPrimary}
            />
          </>
        ) : null}

        {/* —— Quiet: one next action —— */}
        {!showSkeleton && showQuietNextCard && quietNextAction ? (
          <BusinessQuietHomeNextActionCard
            action={quietNextAction}
            onAction={onQuietNextAction}
            onDismiss={onQuietNextDismiss}
          />
        ) : null}
        {!showSkeleton && showQuietActionsNeeded ? (
          <ActionsNeededSection
            items={actionsNeededItems ?? []}
            onMarkAllRead={onDismissAllActions}
          />
        ) : null}

        {/* Suspension / Stripe setup — also in quiet home (not only fulfillment). */}
        {!showSkeleton && !setupMode && verificationStatus ? (
          <BusinessVerificationBanner
            statusOverride={verificationStatus}
            loadingOverride={verificationLoading}
            onRefreshStatus={onRefreshVerification}
            mainInterest={mainInterest}
          />
        ) : null}

        {/* —— Fulfillment: keep actions / tip / readiness below queue —— */}
        {!showSkeleton && fulfillmentMode ? (
          <>
            <ActionsNeededSection
              items={actionsNeededItems ?? []}
              onMarkAllRead={onDismissAllActions}
            />
            {readinessSteps.length > 0 ? (
              <BusinessStoreReadinessCard
                steps={readinessSteps}
                onStepPress={onReadinessStepPress}
              />
            ) : null}
            {merchantTip ? (
              <BusinessMerchantTipCard
                tip={merchantTip}
                onAction={onMerchantTipAction}
                onDismiss={onMerchantTipDismiss}
              />
            ) : null}
          </>
        ) : null}

        {/* —— Quiet: exceptions —— */}
        {!showSkeleton && !setupMode && exceptionModules.length > 0 ? (
          <>
            <Text
              style={[
                typography.overline,
                styles.sectionLabel,
                { color: colors.text.secondary, marginTop: 8 },
              ]}
            >
              {t(
                'business.dashboard.sections.exceptions',
                'Cash & delivery exceptions'
              )}
            </Text>
            {exceptionModules.map((m) => (
              <BusinessModuleCard key={m.id} module={m} loading={loading} />
            ))}
          </>
        ) : null}

        {/* —— Quiet: compact catalog shortcuts —— */}
        {!showSkeleton && quietHomeMode ? (
          <>
            <Text
              style={[
                typography.overline,
                styles.sectionLabel,
                { color: colors.text.secondary, marginTop: 8 },
              ]}
            >
              {t('business.dashboard.sections.catalog', 'Catalog & locations')}
            </Text>
            {quietCatalogModules.map((m) => (
              <BusinessModuleCard key={m.id} module={m} loading={loading} />
            ))}
          </>
        ) : null}

        {/* —— Fulfillment: full modules —— */}
        {!showSkeleton && fulfillmentMode ? (
          <>
            {deliveryModules.length > 0 ? (
              <>
                <Text
                  style={[
                    typography.overline,
                    styles.sectionLabel,
                    { color: colors.text.secondary },
                  ]}
                >
                  {t(
                    'business.dashboard.sections.ordersAndDelivery',
                    'Orders & delivery'
                  )}
                </Text>
                {deliveryModules.map((m) => (
                  <BusinessModuleCard key={m.id} module={m} loading={loading} />
                ))}
              </>
            ) : null}
            <Text
              style={[
                typography.overline,
                styles.sectionLabel,
                { color: colors.text.secondary, marginTop: 8 },
              ]}
            >
              {t('business.dashboard.sections.catalog', 'Catalog & locations')}
            </Text>
            {catalogModules.map((m) => (
              <BusinessModuleCard key={m.id} module={m} loading={loading} />
            ))}
            <BusinessPreviewStoreCta
              visible={showPreviewStoreCta}
              onPress={onPreviewStore}
            />
          </>
        ) : null}

        {/* —— Bottom: wallet (non-zero), promo, referral, admin —— */}
        {showWalletSnapshot ? (
          <ReferralPayoutSnapshot
            availableBalance={walletAvailable}
            balanceCurrency={displayCurrency}
            projectedAmount={referralPayout?.projectedAmount ?? 0}
            projectedCurrency={referralPayout?.currency ?? displayCurrency}
            onOpenWallet={() => navigation.navigate('BusinessAccounts')}
          />
        ) : null}

        {!showSkeleton ? <LaunchPromoBanner /> : null}

        {!showSkeleton && adminModules.length > 0 ? (
          <>
            <Text
              style={[
                typography.overline,
                styles.sectionLabel,
                { color: colors.text.secondary, marginTop: 8 },
              ]}
            >
              {t('business.dashboard.sections.admin', 'Admin')}
            </Text>
            {adminModules.map((m) => (
              <BusinessModuleCard key={m.id} module={m} loading={loading} />
            ))}
          </>
        ) : null}

        {!showSkeleton ? <BusinessReferralCodeCard /> : null}
      </ScrollView>
      <MobilePaymentPhoneChooserSheet
        visible={chooserOpen}
        phones={phones}
        verificationMethod={verificationMethod}
        verifyFirst={mobilePaymentPhoneCtaVariant === 'confirm'}
        explain={
          mobilePaymentPhoneCtaVariant === 'confirm'
            ? verificationMethod !== 'transaction'
              ? t(
                  'mobilePaymentPhone.chooseExplainQuestion',
                  'Confirm the number that receives your Mobile Money payouts, or add a new one.'
                )
              : t(
                  'mobilePaymentPhone.dashboardChooseExplain',
                  'We need to verify that this phone number can receive Mobile Money payments. Verify an existing number, or add a new one.'
                )
            : t(
                'mobilePaymentPhone.chooseExplain',
                'Choose a verified mobile money number to link, or add a new one.'
              )
        }
        onDismiss={onDismissPhoneChooser}
        onSelect={onSelectDashboardPhone}
        onVerify={onVerifyChooserPhone}
        onAddNew={onAddDashboardPhone}
      />
      <MobilePaymentPhoneVerifyModal
        visible={phoneModalOpen}
        mode={phoneModalMode}
        initialPhone={phoneModalInitial}
        onDismiss={onDismissMobilePaymentPhoneVerify}
        onCompleted={onMobilePaymentPhoneVerified}
      />
      <BusinessGoLiveCelebration
        visible={goLiveOpen}
        mainInterest={mainInterest}
        onPreviewStore={onGoLivePreviewStore}
        onAddProduct={onGoLiveAddProduct}
        onDismiss={onDismissGoLive}
      />
      <ActiveOrderCtaHost
        order={activeOrderCtaOrder}
        requestId={activeOrderCtaRequestId}
        onSuccess={onActiveOrderCtaSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingRight: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusChip: { alignSelf: 'center' },
  sectionLabel: { marginBottom: 12, letterSpacing: 1 },
  errorBox: { marginBottom: 16 },
});
