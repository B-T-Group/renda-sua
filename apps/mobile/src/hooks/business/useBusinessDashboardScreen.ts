import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { BusinessModuleCardModel } from '../../components/business/BusinessModuleCard';
import { useDashboardAggregates } from './useDashboardAggregates';
import { useBusinessActiveOrders } from './useBusinessActiveOrders';
import { useProfileMe } from '../useProfileMe';
import { useBusinessVerificationStatus } from '../useBusinessVerificationStatus';
import { useMobilePaymentPhones } from '../useMobilePaymentPhones';
import { businessApi } from '../../services/businessApi';
import { businessVerificationApi } from '../../services/businessVerificationApi';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useActionsNeeded } from '../useActionsNeeded';
import {
  hasCatalogItem,
  isSetupMode,
  markGoLiveCelebrated,
  shouldShowGoLiveCelebration,
} from '../../utils/merchantSetup';
import {
  isMmPhoneReminderDismissed,
  markMmPhoneReminderDismissed,
  resolveMmPhoneReminderVariant,
  shouldShowMmPhoneReminder,
  type MmPhoneReminderVariant,
} from '../../utils/mmPhoneReminder';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
} from '../../types/mobilePaymentPhone';
import type { BusinessLocation } from '../../types/business/locations';
import type { BusinessOrder } from '../../types/business/orders';
import { useStore } from '../../stores/RootStore';
import {
  ensureFirstOrderPinForOrder,
  reconcileStaleFirstOrderPin,
} from '../../utils/firstOrderPinSync';
import { getEnv } from '../../config/auth0';
import {
  buildReadinessSteps,
  resolveMerchantTip,
  type ReadinessStepId,
} from '../../utils/businessStoreReadiness';
import { resolveCatalogHealth } from '../../utils/catalogHealth';
import { resolveQuietHomeNextAction } from '../../utils/resolveQuietHomeNextAction';
import { subscribeTipsRemindersChanged } from '../../utils/tipsRemindersSync';
import {
  navigateBusinessOrdersTab,
  navigateBusinessRentals,
  navigateBusinessSaleItems,
} from '../../utils/navigateBusinessTabs';
import type { ActiveOrderCardModel } from '../../utils/buildActiveOrderCardModel';

function storeShareBaseUrl(apiUrl: string): string {
  if (apiUrl.includes('localhost') || apiUrl.includes('dev.api')) {
    return 'https://dev.rendasua.com';
  }
  return 'https://rendasua.com';
}

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

function locationNeedsVerifiedPhone(loc: BusinessLocation): boolean {
  return loc.is_active && loc.mobile_payment_phone?.is_verified !== true;
}

export function useBusinessDashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { ftue, incomingOrder } = useStore();
  const { data, loading, error, refresh } = useDashboardAggregates();
  const activeOrdersState = useBusinessActiveOrders();
  const { me, loading: profileLoading, refetch: refetchMe } = useProfileMe();
  const verification = useBusinessVerificationStatus();
  const [tipEpoch, setTipEpoch] = useState(0);
  const [activeOrderCtaOrder, setActiveOrderCtaOrder] =
    useState<BusinessOrder | null>(null);
  const [activeOrderCtaRequestId, setActiveOrderCtaRequestId] = useState(0);
  const [tipsRemindersOverride, setTipsRemindersOverride] = useState<
    boolean | null
  >(null);
  const markedTipIdRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeTipsRemindersChanged((enabled) => {
      setTipsRemindersOverride(enabled);
    });
  }, []);
  const isMobileMoneyRail = verification.status?.paymentRail === 'mobile_money';
  const { phones, fetchPhones, verificationMethod } = useMobilePaymentPhones(
    !!isMobileMoneyRail
  );
  const [chooserOpen, setChooserOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneModalMode, setPhoneModalMode] =
    useState<MobilePaymentPhoneModalMode>('add');
  const [phoneModalInitial, setPhoneModalInitial] =
    useState<MobilePaymentPhone | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [phoneReminderDismissed, setPhoneReminderDismissed] = useState<
    boolean | null
  >(null);
  const {
    items: actionsNeededItems,
    totalCount: actionsNeededTotal,
    refresh: refreshActionsNeeded,
    dismissAll: dismissAllActionsNeeded,
  } = useActionsNeeded('business');

  const ordersModule: BusinessModuleCardModel = useMemo(() => {
    const orderCountByStatus = activeOrdersState.orders.reduce<
      Record<string, number>
    >((acc, order) => {
      const status = order.current_status || 'unknown';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      id: 'orders',
      title: t('business.dashboard.ordersTitle', 'Orders'),
      description: t(
        'business.dashboard.ordersDescription',
        'View and manage customer orders, track delivery status, and handle fulfillment.'
      ),
      icon: 'clipboard-list-outline',
      count: activeOrdersState.activeCount,
      orderCountByStatus,
      showBadge: activeOrdersState.activeCount > 0,
      onPress: () => navigateBusinessOrdersTab(navigation),
    };
  }, [t, navigation, activeOrdersState.activeCount, activeOrdersState.orders]);

  const cashModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'cash',
      title: t('business.dashboard.cashReconciliationTitle', 'Cash reconciliation'),
      description: t(
        'business.dashboard.cashReconciliationDescription',
        'Pay-at-delivery orders with a cash exception—collect mobile payment per order.'
      ),
      icon: 'cash-multiple',
      count: data?.pendingCashReconciliationCount ?? 0,
      accentColor: colors.warning.dark,
      showBadge: true,
      onPress: () =>
        navigateBusinessOrdersTab(navigation, { cashReconciliation: true }),
    }),
    [t, data, navigation, colors.warning.dark]
  );

  const failedModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'failed',
      title: t('business.dashboard.failedDeliveries', 'Failed deliveries'),
      description: t(
        'business.dashboard.failedDeliveriesDescription',
        'Manage and resolve failed deliveries for your business.'
      ),
      icon: 'alert-circle-outline',
      count: data?.pendingFailedDeliveriesCount ?? 0,
      accentColor: colors.error.dark,
      showBadge: true,
      onPress: () => navigation.navigate('BusinessFailedDeliveriesList'),
    }),
    [t, data, navigation]
  );

  const itemsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'items',
      title: t('business.dashboard.itemsTitle', 'Items'),
      description: t(
        'business.dashboard.itemsDescription',
        'Manage your product catalog and update product information.'
      ),
      icon: 'package-variant',
      count: data?.itemCount ?? 0,
      onPress: () =>
        navigateBusinessSaleItems(
          navigation,
          me?.business?.main_interest ?? 'sell_items'
        ),
    }),
    [t, data, navigation, me?.business?.main_interest]
  );

  const locationsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'locations',
      title: t('business.dashboard.locationsTitle', 'Locations'),
      description: t(
        'business.dashboard.locationsDescription',
        'Manage your business locations, addresses, and operational settings.'
      ),
      icon: 'map-marker-outline',
      count: data?.locationCount ?? 0,
      onPress: () => navigation.navigate('BusinessLocationsList'),
    }),
    [t, data, navigation]
  );

  const teamModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'team',
      title: t('delegation.team.title', 'Team'),
      description: t(
        'delegation.team.menuSubtitle',
        'Invite people to manage orders at a location'
      ),
      icon: 'account-multiple-outline',
      count: null,
      onPress: () => navigation.navigate('BusinessTeam'),
    }),
    [t, navigation]
  );

  const rentalsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'rentals',
      title: t('business.dashboard.rentalsTitle', 'Rentals'),
      description: t(
        'business.dashboard.rentalsDescription',
        'Manage rental catalog, booking requests, and schedule.'
      ),
      icon: 'calendar-clock',
      count: data?.rentalItemCount ?? 0,
      onPress: () =>
        navigateBusinessRentals(
          navigation,
          me?.business?.main_interest ?? 'sell_items'
        ),
    }),
    [t, data, navigation, me?.business?.main_interest]
  );

  const rentalModerationModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'rental-moderation',
      title: t('admin.rentals.moderation.dashboardTitle', 'Rental listing moderation'),
      description: t(
        'admin.rentals.moderation.dashboardDescription',
        'Approve or reject rental listings before they appear in the catalog.'
      ),
      icon: 'clipboard-check-outline',
      count: null,
      accentColor: colors.warning.dark,
      onPress: () => navigation.navigate('AdminRentalListingsModeration'),
    }),
    [t, navigation, colors.warning.dark]
  );

  const rentalAiReviewsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'rental-ai-reviews',
      title: t('admin.rentals.aiReviews.dashboardTitle', 'AI review audit'),
      description: t(
        'admin.rentals.aiReviews.dashboardDescription',
        'Review AI auto-approvals and rejections to tune prompts.'
      ),
      icon: 'robot-outline',
      count: null,
      accentColor: colors.info.dark ?? colors.info.main,
      onPress: () => navigation.navigate('AdminRentalAiReviews'),
    }),
    [t, navigation, colors.info]
  );

  const itemModerationModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'item-moderation',
      title: t('admin.items.moderation.dashboardTitle', 'Sale item moderation'),
      description: t(
        'admin.items.moderation.dashboardDescription',
        'Approve or reject sale items before they appear in the catalog.'
      ),
      icon: 'clipboard-text-outline',
      count: null,
      accentColor: colors.warning.dark,
      onPress: () => navigation.navigate('AdminItemModeration'),
    }),
    [t, navigation, colors.warning.dark]
  );

  const itemAiReviewsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'item-ai-reviews',
      title: t('admin.items.aiReviews.dashboardTitle', 'Sale item AI audit'),
      description: t(
        'admin.items.aiReviews.dashboardDescription',
        'Review AI decisions on sale items to tune prompts.'
      ),
      icon: 'creation',
      count: null,
      accentColor: colors.info.dark ?? colors.info.main,
      onPress: () => navigation.navigate('AdminItemAiReviews'),
    }),
    [t, navigation, colors.info]
  );

  const itemsBrowserModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'items-browser',
      title: t('admin.itemsBrowser.dashboardTitle', 'All items'),
      description: t(
        'admin.itemsBrowser.dashboardDescription',
        'Search and edit sale items across businesses, including image cleanup.'
      ),
      icon: 'package-variant-closed',
      count: null,
      accentColor: colors.primary.main,
      onPress: () => navigation.navigate('AdminItemsBrowser'),
    }),
    [t, navigation, colors.primary.main]
  );

  const businessVerificationModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'business-verification',
      title: t('admin.businesses.dashboardTitle', 'Business verification'),
      description: t(
        'admin.businesses.dashboardDescription',
        'Review merchant contracts, ID documents, and payment readiness.'
      ),
      icon: 'shield-check-outline',
      count: null,
      accentColor: colors.warning.dark,
      onPress: () => navigation.navigate('AdminBusinessesList'),
    }),
    [t, navigation, colors.warning.dark]
  );

  const performanceModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'platform-performance',
      title: t('admin.performance.dashboardTitle', 'Platform performance'),
      description: t(
        'admin.performance.dashboardDescription',
        'Enrollment and catalog growth by market, plus top performing agents.'
      ),
      icon: 'chart-line',
      count: null,
      accentColor: colors.success.dark ?? colors.success.main,
      onPress: () => navigation.navigate('AdminPerformance'),
    }),
    [t, navigation, colors.success]
  );

  const broadcastsModule: BusinessModuleCardModel = useMemo(
    () => ({
      id: 'admin-broadcasts',
      title: t('admin.broadcasts.title', 'Global messaging'),
      description: t(
        'admin.broadcasts.menuSubtitle',
        'Send targeted notifications to users'
      ),
      icon: 'bullhorn-outline',
      count: null,
      accentColor: colors.primary.main,
      onPress: () => navigation.navigate('AdminBroadcasts'),
    }),
    [t, navigation, colors.primary.main]
  );

  const whatsappInboxModule = useMemo(
    (): BusinessModuleCardModel => ({
      id: 'admin-whatsapp-inbox',
      title: t('admin.whatsappInbox.title', 'WhatsApp inbox'),
      description: t(
        'admin.whatsappInbox.menuSubtitle',
        'Reply to customer support chats'
      ),
      icon: 'whatsapp',
      count: null,
      accentColor: colors.success.main,
      onPress: () => navigation.navigate('AdminWhatsAppInbox'),
    }),
    [t, navigation, colors.success.main]
  );

  const deliveryModules = useMemo(() => {
    if ((data?.ordersTotal ?? 0) > 0 || activeOrdersState.activeCount > 0) {
      return [ordersModule];
    }
    return [];
  }, [ordersModule, data?.ordersTotal, activeOrdersState.activeCount]);
  const catalogModules = useMemo(
    () => [itemsModule, rentalsModule, locationsModule, teamModule],
    [itemsModule, rentalsModule, locationsModule, teamModule]
  );
  // Only surface when there is pending work — hide empty exception cards.
  const exceptionModules = useMemo(() => {
    const modules: BusinessModuleCardModel[] = [];
    if ((cashModule.count ?? 0) > 0) modules.push(cashModule);
    if ((failedModule.count ?? 0) > 0) modules.push(failedModule);
    return modules;
  }, [cashModule, failedModule]);
  const { isSuperuser, can } = usePermissions(me);
  const canManageBusinesses =
    isSuperuser || can(PlatformPermissions.MANAGE_BUSINESSES);
  const canViewPlatformStats =
    isSuperuser || can(PlatformPermissions.DASHBOARD_PLATFORM_STATS);
  const canModerateRentals =
    isSuperuser || can(PlatformPermissions.MODERATE_RENTALS);
  const canModerateItems =
    isSuperuser || can(PlatformPermissions.MODERATE_ITEMS);
  const canBrowseCatalog =
    isSuperuser || can(PlatformPermissions.CATALOG_CROSS_BUSINESS);
  const canSendBroadcasts =
    isSuperuser || can(PlatformPermissions.OPS_USER_MESSAGES);
  const canSeeWhatsAppInbox =
    isSuperuser || can(PlatformPermissions.OPS_WHATSAPP_INBOX);
  const adminModules = useMemo(
    () => [
      ...(canViewPlatformStats ? [performanceModule] : []),
      ...(canSendBroadcasts ? [broadcastsModule] : []),
      ...(canSeeWhatsAppInbox ? [whatsappInboxModule] : []),
      ...(canManageBusinesses ? [businessVerificationModule] : []),
      ...(canModerateRentals
        ? [rentalModerationModule, rentalAiReviewsModule]
        : []),
      ...(canModerateItems ? [itemModerationModule, itemAiReviewsModule] : []),
      ...(canBrowseCatalog ? [itemsBrowserModule] : []),
    ],
    [
      canManageBusinesses,
      canViewPlatformStats,
      canSendBroadcasts,
      canSeeWhatsAppInbox,
      canModerateRentals,
      canModerateItems,
      canBrowseCatalog,
      performanceModule,
      broadcastsModule,
      whatsappInboxModule,
      businessVerificationModule,
      rentalModerationModule,
      rentalAiReviewsModule,
      itemModerationModule,
      itemAiReviewsModule,
      itemsBrowserModule,
    ]
  );

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      refresh({ silent: true }),
      refetchMe({ silent: true }),
      verification.refetch(),
      refreshActionsNeeded(),
      activeOrdersState.refresh(),
      isMobileMoneyRail ? fetchPhones() : Promise.resolve(),
    ]);
  }, [
    refresh,
    refetchMe,
    verification.refetch,
    refreshActionsNeeded,
    activeOrdersState.refresh,
    isMobileMoneyRail,
    fetchPhones,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [refreshDashboard]);

  useFocusEffect(
    useCallback(() => {
      void refreshDashboard();
    }, [refreshDashboard])
  );

  const mainInterest = me?.business?.main_interest ?? 'sell_items';
  const quietCatalogModules = useMemo(() => {
    if (mainInterest === 'rent_items') {
      const secondary =
        (data?.itemCount ?? 0) > 0 ? [itemsModule] : [];
      return [rentalsModule, ...secondary, locationsModule];
    }
    const secondary =
      (data?.rentalItemCount ?? 0) > 0 ? [rentalsModule] : [];
    return [itemsModule, ...secondary, locationsModule];
  }, [
    mainInterest,
    itemsModule,
    rentalsModule,
    locationsModule,
    data?.itemCount,
    data?.rentalItemCount,
  ]);
  const initialLoading = (loading || profileLoading) && !data;
  const aggregatesReady = !loading;
  const rentalItemCount = data?.rentalItemCount ?? 0;
  const itemCount = data?.itemCount ?? 0;
  // Hide modules while the first verification fetch is in flight (loading starts true).
  const setupMode =
    (verification.loading && verification.status == null) ||
    isSetupMode(verification.status);
  const interestItemCount =
    mainInterest === 'rent_items' ? rentalItemCount : itemCount;
  const showSetupPreviewStore =
    setupMode &&
    (hasCatalogItem(verification.status) || interestItemCount > 0);
  const phoneReminderVariant: MmPhoneReminderVariant | null = setupMode
    ? null
    : resolveMmPhoneReminderVariant(verification.status);
  const showMobilePaymentPhoneCta =
    !setupMode &&
    phoneReminderDismissed !== null &&
    shouldShowMmPhoneReminder(
      verification.status,
      phoneReminderDismissed === true
    );
  const hasVerifiedPhone = phones.some((p) => p.is_verified);
  const mobilePaymentPhoneCtaVariant: 'none' | 'link' | 'confirm' =
    phones.length === 0 ? 'none' : hasVerifiedPhone ? 'link' : 'confirm';
  const showIdReviewCard =
    isMobileMoneyRail &&
    !setupMode &&
    !!verification.status?.steps.identity &&
    verification.status.steps.identity.status !== 'approved' &&
    verification.status.steps.identity.status !== 'missing';

  const attachPhoneToNeedingLocations = useCallback(
    async (phoneId: string) => {
      const res = await businessApi.locations.list();
      const needing = (res.data?.business_locations ?? []).filter(
        locationNeedsVerifiedPhone
      );
      await Promise.all(
        needing.map((loc) =>
          businessApi.locations.update(loc.id, {
            mobile_payment_phone_id: phoneId,
          })
        )
      );
    },
    []
  );

  const finishPhoneLink = useCallback(
    async (phone: MobilePaymentPhone) => {
      if (!phone.is_verified) return;
      await attachPhoneToNeedingLocations(phone.id);
      setChooserOpen(false);
      setPhoneModalOpen(false);
      setPhoneModalInitial(null);
      await fetchPhones();
      await verification.refetch();
    },
    [attachPhoneToNeedingLocations, fetchPhones, verification]
  );

  const onOpenMobilePaymentPhoneVerify = useCallback(() => {
    if (phones.length === 0) {
      setPhoneModalMode('add');
      setPhoneModalInitial(null);
      setPhoneModalOpen(true);
      return;
    }
    setChooserOpen(true);
  }, [phones.length]);

  const onDismissPhoneChooser = useCallback(() => {
    setChooserOpen(false);
  }, []);

  const onSelectDashboardPhone = useCallback(
    (phone: MobilePaymentPhone) => {
      void (async () => {
        await finishPhoneLink(phone);
        if (setupMode && phone.is_verified) {
          navigation.navigate('BusinessSetupStepSuccess', {
            step: 'mobileMoney',
            variant: 'continue',
          });
        }
      })();
    },
    [finishPhoneLink, setupMode, navigation]
  );

  const onVerifyChooserPhone = useCallback((phone: MobilePaymentPhone) => {
    setChooserOpen(false);
    setPhoneModalMode('verify');
    setPhoneModalInitial(phone);
    setPhoneModalOpen(true);
  }, []);

  const onAddDashboardPhone = useCallback(() => {
    setChooserOpen(false);
    setPhoneModalMode('add');
    setPhoneModalInitial(null);
    setPhoneModalOpen(true);
  }, []);

  const onDismissMobilePaymentPhoneVerify = useCallback(() => {
    setPhoneModalOpen(false);
    setPhoneModalInitial(null);
  }, []);

  const onMobilePaymentPhoneVerified = useCallback(
    (phone: MobilePaymentPhone) => {
      void (async () => {
        await finishPhoneLink(phone);
        if (setupMode) {
          navigation.navigate('BusinessSetupStepSuccess', {
            step: 'mobileMoney',
            variant: 'continue',
          });
        }
      })();
    },
    [finishPhoneLink, setupMode, navigation]
  );
  const showFirstSaleCta =
    !setupMode &&
    aggregatesReady &&
    !profileLoading &&
    mainInterest === 'sell_items' &&
    (data?.itemCount ?? 0) === 0;
  const showFirstRentalCta =
    !setupMode &&
    aggregatesReady &&
    !profileLoading &&
    mainInterest === 'rent_items' &&
    rentalItemCount === 0;

  const onStartFirstItem = useCallback(() => {
    navigation.navigate('BusinessAddItemFromImage');
  }, [navigation]);

  const onStartFirstRental = useCallback(() => {
    navigation.navigate('BusinessAddRentalFromImage');
  }, [navigation]);

  const onSetupSignAgreement = useCallback(() => {
    navigation.navigate('BusinessMerchantAgreement');
  }, [navigation]);

  const onSetupPayouts = useCallback(() => {
    navigation.navigate('BusinessConfigurePayments');
  }, [navigation]);

  const onSetupUploadId = useCallback(() => {
    navigation.navigate('Documents', { returnToDashboard: true });
  }, [navigation]);

  const onSetupAddProduct = useCallback(() => {
    if (mainInterest === 'rent_items') {
      navigation.navigate('BusinessAddRentalFromImage', { returnToDashboard: true });
      return;
    }
    navigation.navigate('BusinessAddItemFromImage', { returnToDashboard: true });
  }, [mainInterest, navigation]);

  const onSetupManageLocations = useCallback(() => {
    navigation.navigate('BusinessLocationsList');
  }, [navigation]);

  const onSetupViewItems = useCallback(() => {
    if (mainInterest === 'rent_items') {
      navigateBusinessRentals(navigation, mainInterest);
      return;
    }
    navigateBusinessSaleItems(navigation, mainInterest);
  }, [mainInterest, navigation]);

  const onSetupRefresh = useCallback(async () => {
    try {
      await businessVerificationApi.refreshContract();
    } catch {
      // Status refresh still useful if contract refresh fails.
    }
    await verification.refetch();
  }, [verification]);

  const onOpenInsights = useCallback(() => {
    navigation.navigate('BusinessInsights');
  }, [navigation]);

  const businessId = me?.business?.id;
  const showPreviewStoreCta = !!businessId && !error;
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const goLiveDismissedRef = useRef(false);
  const canAcceptOrders = verification.status?.can_accept_orders === true;

  const prevBusinessIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (businessId && businessId !== prevBusinessIdRef.current) {
      goLiveDismissedRef.current = false;
      setPhoneReminderDismissed(null);
    }
    prevBusinessIdRef.current = businessId;
  }, [businessId]);

  useEffect(() => {
    if (!businessId || activeOrdersState.loading) return;
    const activeIds = activeOrdersState.orders.map((order) => order.id);
    const isLegacyNudgeConverted =
      !ftue.isNudgeEligible('first-order-onboarding');
    for (const order of activeOrdersState.orders) {
      void ensureFirstOrderPinForOrder(order, {
        businessId,
        ordersTotal: data?.ordersTotal,
        isLegacyNudgeConverted,
        source: 'dashboard',
      });
    }
    void reconcileStaleFirstOrderPin(
      businessId,
      activeIds,
      async (orderId) => {
        try {
          const res = await businessApi.orders.getById(orderId);
          return res.order ?? null;
        } catch {
          return null;
        }
      },
      { convertNudge: (id) => ftue.convertNudge(id) }
    );
  }, [
    activeOrdersState.loading,
    activeOrdersState.orders,
    businessId,
    data?.ordersTotal,
    ftue,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!businessId || !isMobileMoneyRail) {
      setPhoneReminderDismissed(false);
      return;
    }
    void isMmPhoneReminderDismissed(businessId).then((dismissed) => {
      if (!cancelled) setPhoneReminderDismissed(dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, isMobileMoneyRail]);

  const onDismissMobilePaymentPhoneReminder = useCallback(() => {
    setPhoneReminderDismissed(true);
    if (businessId) {
      void markMmPhoneReminderDismissed(businessId);
    }
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;
    if (setupMode || !canAcceptOrders || !businessId) {
      if (!canAcceptOrders) setGoLiveOpen(false);
      return;
    }
    if (goLiveDismissedRef.current) return;
    void shouldShowGoLiveCelebration(verification.status, businessId).then(
      (show) => {
        if (!cancelled && !goLiveDismissedRef.current) setGoLiveOpen(show);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [setupMode, canAcceptOrders, businessId, verification.status]);

  const onPreviewStore = useCallback(() => {
    if (!businessId) return;
    navigation.navigate('StoreDetail', { businessId, previewMode: true });
  }, [businessId, navigation]);

  const onDismissGoLive = useCallback(() => {
    goLiveDismissedRef.current = true;
    setGoLiveOpen(false);
    if (businessId) {
      void markGoLiveCelebrated(businessId);
    }
  }, [businessId]);

  const onGoLivePreviewStore = useCallback(() => {
    onDismissGoLive();
    onPreviewStore();
  }, [onDismissGoLive, onPreviewStore]);

  const onGoLiveAddProduct = useCallback(() => {
    onDismissGoLive();
    onSetupAddProduct();
  }, [onDismissGoLive, onSetupAddProduct]);

  const actionsNeededPendingFocus = useMemo(
    () =>
      actionsNeededItems.some(
        (a) =>
          a.kind === 'item_proposal_pending' ||
          a.kind === 'rental_proposal_pending'
      ),
    [actionsNeededItems]
  );

  const tipsRemindersEnabled =
    tipsRemindersOverride ?? data?.tipsRemindersEnabled !== false;

  const readinessSteps = useMemo(
    () =>
      buildReadinessSteps({
        aggregates: data,
        verification: verification.status,
        mainInterest,
        aiTokens: me?.business?.ai_tokens ?? 0,
        tipsRemindersEnabled,
        actionsNeededPendingFocus,
        isNudgeEligible: (id) => ftue.isNudgeEligible(id),
      }),
    [
      data,
      verification.status,
      mainInterest,
      me?.business?.ai_tokens,
      tipsRemindersEnabled,
      actionsNeededPendingFocus,
      ftue,
      tipEpoch,
    ]
  );

  const merchantTip = useMemo(
    () =>
      setupMode
        ? null
        : resolveMerchantTip({
            aggregates: data,
            verification: verification.status,
            mainInterest,
            aiTokens: me?.business?.ai_tokens ?? 0,
            tipsRemindersEnabled,
            actionsNeededPendingFocus,
            isNudgeEligible: (id) => ftue.isNudgeEligible(id),
          }),
    [
      setupMode,
      data,
      verification.status,
      mainInterest,
      me?.business?.ai_tokens,
      tipsRemindersEnabled,
      actionsNeededPendingFocus,
      ftue,
      tipEpoch,
    ]
  );

  const quietHomeMode =
    !setupMode && activeOrdersState.orders.length === 0;
  const fulfillmentMode =
    !setupMode && activeOrdersState.orders.length > 0;

  const catalogHealth = useMemo(
    () => resolveCatalogHealth(data, mainInterest),
    [data, mainInterest]
  );

  const quietNextAction = useMemo(() => {
    if (!quietHomeMode) return null;
    return resolveQuietHomeNextAction({
      aggregates: data,
      verification: verification.status,
      mainInterest,
      aiTokens: me?.business?.ai_tokens ?? 0,
      tipsRemindersEnabled,
      actionsNeededPendingFocus,
      actionsNeededCount: actionsNeededItems.length,
      showIdReview: showIdReviewCard,
      showMmPhoneConfirm: showMobilePaymentPhoneCta,
      isNudgeEligible: (id) => ftue.isNudgeEligible(id),
      skipReachDuplicateTips: true,
    });
  }, [
    quietHomeMode,
    data,
    verification.status,
    mainInterest,
    me?.business?.ai_tokens,
    tipsRemindersEnabled,
    actionsNeededPendingFocus,
    actionsNeededItems.length,
    showIdReviewCard,
    showMobilePaymentPhoneCta,
    ftue,
    tipEpoch,
  ]);

  useEffect(() => {
    const tipId =
      quietHomeMode && quietNextAction
        ? quietNextAction.kind === 'tip' || quietNextAction.kind === 'celebration'
          ? quietNextAction.id
          : null
        : merchantTip?.id ?? null;
    if (!tipId) return;
    const key = `merchant-tip:${tipId}`;
    if (markedTipIdRef.current === key) return;
    markedTipIdRef.current = key;
    void ftue.markNudgeShown(key);
  }, [ftue, quietHomeMode, quietNextAction, merchantTip]);

  const onReadinessStepPress = useCallback(
    (id: ReadinessStepId) => {
      if (id === 'logo' || id === 'hours') {
        navigation.navigate('BusinessLocationsList');
        return;
      }
      if (id === 'catalog_10') {
        onSetupAddProduct();
        return;
      }
      if (id === 'mm_phone') {
        onOpenMobilePaymentPhoneVerify();
      }
    },
    [navigation, onOpenMobilePaymentPhoneVerify, onSetupAddProduct]
  );

  const onShareStorefront = useCallback(async () => {
    if (!businessId) return;
    const url = `${storeShareBaseUrl(getEnv().apiUrl)}/store/${businessId}`;
    await Share.share({
      message: t('stores.shareMessage', 'Check out {{name}} on Rendasua: {{url}}', {
        name: me?.business?.name ?? t('stores.unnamed', 'Store'),
        url,
      }),
      url,
    });
  }, [businessId, me?.business?.name, t]);

  const presentIncomingOverlay = useCallback(
    async (order: BusinessOrder) => {
      try {
        const res = await businessApi.orders.getById(order.id);
        const live = res.order;
        const canPresentInterrupt =
          live?.current_status === 'pending' &&
          live.acceptance_state !== 'scheduled';
        if (!canPresentInterrupt) {
          navigation.navigate('BusinessOrderDetail', { orderId: order.id });
          return;
        }
      } catch {
        navigation.navigate('BusinessOrderDetail', { orderId: order.id });
        return;
      }
      if (incomingOrder.visible && incomingOrder.orderId === order.id) {
        return;
      }
      void incomingOrder.present(order.id);
    },
    [navigation, incomingOrder]
  );

  const runActiveOrderCta = useCallback(
    (order: BusinessOrder, model: ActiveOrderCardModel) => {
      if (model.destination.kind === 'incoming_overlay') {
        void presentIncomingOverlay(order);
        return;
      }
      if (model.destination.kind === 'refunds') {
        navigation.navigate('BusinessRefundsList');
        return;
      }
      if (model.destination.kind === 'perform_action') {
        setActiveOrderCtaOrder(order);
        setActiveOrderCtaRequestId((n) => n + 1);
        return;
      }
      navigation.navigate('BusinessOrderDetail', { orderId: order.id });
    },
    [navigation, presentIncomingOverlay]
  );

  const openActiveOrder = useCallback(
    (order: BusinessOrder, _model: ActiveOrderCardModel) => {
      if (incomingOrder.visible && incomingOrder.orderId === order.id) {
        return;
      }
      navigation.navigate('BusinessOrderDetail', { orderId: order.id });
    },
    [incomingOrder.visible, incomingOrder.orderId, navigation]
  );

  const onActiveOrderCta = useCallback(
    (order: BusinessOrder, model: ActiveOrderCardModel) => {
      if (incomingOrder.visible && incomingOrder.orderId === order.id) {
        return;
      }
      runActiveOrderCta(order, model);
    },
    [incomingOrder.visible, incomingOrder.orderId, runActiveOrderCta]
  );

  const onActiveOrderCtaSuccess = useCallback(() => {
    void activeOrdersState.refresh();
    void refreshActionsNeeded();
  }, [activeOrdersState.refresh, refreshActionsNeeded]);

  const onMerchantTipAction = useCallback(() => {
    if (!merchantTip) return;
    void ftue.convertNudge(`merchant-tip:${merchantTip.id}`);
    setTipEpoch((n) => n + 1);
    const id = merchantTip.id;
    if (
      id === 'catalog_goal' ||
      id === 'catalog_variety' ||
      id === 'views_10_congrats'
    ) {
      onSetupAddProduct();
      return;
    }
    if (id === 'first_order_congrats') {
      const first = activeOrdersState.orders[0];
      if (first) {
        openActiveOrder(first, {
          orderId: first.id,
          orderNumber: first.order_number,
          customerName: null,
          itemCount: 0,
          totalLabel: '',
          status: first.current_status || '',
          phase: 'confirm',
          primaryActionId: 'confirm',
          titleKey: 'business.dashboard.activeOrders.titles.newOrder',
          titleDefault: 'New Order',
          subtitleKey: 'business.dashboard.activeOrders.subtitles.newOrder',
          subtitleDefault: 'A customer is waiting for your response.',
          ctaKey: 'business.dashboard.activeOrders.cta.accept',
          ctaDefault: 'Accept Order',
          urgency: 'warning',
          createdAt: first.created_at,
          destination:
            first.current_status === 'pending'
              ? { kind: 'incoming_overlay' }
              : { kind: 'order_detail' },
        });
        return;
      }
      navigateBusinessOrdersTab(navigation);
      return;
    }
    if (id === 'catalog_10_congrats' || id === 'share_store') {
      void onShareStorefront();
      return;
    }
    if (id === 'rejected_item') {
      if (mainInterest === 'rent_items') {
        navigateBusinessRentals(navigation, mainInterest, {
          moderationStatus: 'rejected',
        });
        return;
      }
      navigateBusinessSaleItems(navigation, mainInterest, {
        moderationStatus: 'rejected',
      });
      return;
    }
    if (id === 'pending_moderation') {
      onSetupViewItems();
      return;
    }
    if (id === 'restock_top_viewed') {
      onSetupViewItems();
      return;
    }
    if (id === 'ai_photos_pending') {
      onSetupViewItems();
      return;
    }
    if (id === 'ai_tokens_empty' || id === 'ai_photos') {
      navigation.navigate('BusinessAiTokens');
      return;
    }
    if (id === 'logo' || id === 'hours') {
      navigation.navigate('BusinessLocationsList');
      return;
    }
    if (id === 'preview_store') {
      onPreviewStore();
      return;
    }
    if (id === 'insights') {
      onOpenInsights();
    }
  }, [
    merchantTip,
    ftue,
    mainInterest,
    onSetupAddProduct,
    navigation,
    onShareStorefront,
    onSetupViewItems,
    onPreviewStore,
    onOpenInsights,
    activeOrdersState.orders,
    openActiveOrder,
  ]);

  const onMerchantTipDismiss = useCallback(() => {
    if (!merchantTip) return;
    const key = `merchant-tip:${merchantTip.id}`;
    if (merchantTip.kind === 'celebration') {
      void ftue.convertNudge(key);
    } else {
      void ftue.dismissNudge(key);
    }
    setTipEpoch((n) => n + 1);
  }, [ftue, merchantTip]);

  const onCatalogHealthPrimary = useCallback(() => {
    const primary = catalogHealth.primary;
    if (primary === 'fix_rejected') {
      if (mainInterest === 'rent_items') {
        navigateBusinessRentals(navigation, mainInterest, {
          moderationStatus: 'rejected',
        });
        return;
      }
      navigateBusinessSaleItems(navigation, mainInterest, {
        moderationStatus: 'rejected',
      });
      return;
    }
    if (primary === 'restock' || primary === 'manage') {
      onSetupViewItems();
      return;
    }
    onSetupAddProduct();
  }, [
    catalogHealth.primary,
    mainInterest,
    navigation,
    onSetupViewItems,
    onSetupAddProduct,
  ]);

  const onQuietNextAction = useCallback(() => {
    if (!quietNextAction) return;
    const id = quietNextAction.id;
    if (quietNextAction.kind === 'tip' || quietNextAction.kind === 'celebration') {
      void ftue.convertNudge(`merchant-tip:${id}`);
      setTipEpoch((n) => n + 1);
    }
    if (id === 'cannot_accept_orders') {
      if (verification.status?.nextAction === 'upload_id') {
        onSetupUploadId();
        return;
      }
      if (verification.status?.nextAction === 'verify_mobile_payment_phone') {
        onOpenMobilePaymentPhoneVerify();
        return;
      }
      if (verification.status?.nextAction === 'setup_stripe_connect') {
        onSetupPayouts();
        return;
      }
      onSetupRefresh();
      return;
    }
    if (id === 'id_review') {
      onSetupUploadId();
      return;
    }
    if (id === 'confirm_mm_phone') {
      onOpenMobilePaymentPhoneVerify();
      return;
    }
    if (id === 'actions_needed') {
      // Items are listed inline via ActionsNeededSection.
      return;
    }
    if (
      id === 'catalog_goal' ||
      id === 'catalog_variety' ||
      id === 'views_10_congrats'
    ) {
      onSetupAddProduct();
      return;
    }
    if (id === 'first_order_congrats') {
      navigateBusinessOrdersTab(navigation);
      return;
    }
    if (id === 'catalog_10_congrats' || id === 'share_store') {
      void onShareStorefront();
      return;
    }
    if (id === 'rejected_item') {
      if (mainInterest === 'rent_items') {
        navigateBusinessRentals(navigation, mainInterest, {
          moderationStatus: 'rejected',
        });
        return;
      }
      navigateBusinessSaleItems(navigation, mainInterest, {
        moderationStatus: 'rejected',
      });
      return;
    }
    if (id === 'pending_moderation') {
      onSetupViewItems();
      return;
    }
    if (id === 'restock_top_viewed') {
      onSetupViewItems();
      return;
    }
    if (id === 'ai_photos_pending') {
      onSetupViewItems();
      return;
    }
    if (id === 'ai_tokens_empty' || id === 'ai_photos') {
      navigation.navigate('BusinessAiTokens');
      return;
    }
    if (id === 'logo' || id === 'hours') {
      navigation.navigate('BusinessLocationsList');
      return;
    }
    if (id === 'preview_store') {
      onPreviewStore();
      return;
    }
    if (id === 'insights') {
      onOpenInsights();
      return;
    }
    if (id === 'offer_rentals') {
      navigateBusinessRentals(navigation, mainInterest);
      return;
    }
    if (id === 'offer_sale_items') {
      navigateBusinessSaleItems(navigation, mainInterest);
    }
  }, [
    quietNextAction,
    ftue,
    verification.status,
    onSetupUploadId,
    onOpenMobilePaymentPhoneVerify,
    onSetupPayouts,
    onSetupRefresh,
    onSetupAddProduct,
    navigation,
    onShareStorefront,
    mainInterest,
    onSetupViewItems,
    onPreviewStore,
    onOpenInsights,
  ]);

  const onQuietNextDismiss = useCallback(() => {
    if (!quietNextAction) return;
    if (
      quietNextAction.kind !== 'tip' &&
      quietNextAction.kind !== 'celebration'
    ) {
      return;
    }
    const key = `merchant-tip:${quietNextAction.id}`;
    if (quietNextAction.kind === 'celebration') {
      void ftue.convertNudge(key);
    } else {
      void ftue.dismissNudge(key);
    }
    setTipEpoch((n) => n + 1);
  }, [ftue, quietNextAction]);

  return {
    loading: loading || profileLoading,
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
    hasAnyItem: interestItemCount > 0,
    showSetupPreviewStore,
    showFirstSaleCta,
    showFirstRentalCta,
    showPreviewStoreCta: !setupMode && showPreviewStoreCta,
    uniqueClientCount: error ? null : (data?.uniqueClientCount ?? null),
    totalProductViews: error ? null : (data?.totalProductViews ?? null),
    catalogHealth,
    quietNextAction,
    onCatalogHealthPrimary,
    onQuietNextAction,
    onQuietNextDismiss,
    onShareStorefront,
    onStartFirstItem,
    onStartFirstRental,
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
    retry: refresh,
    verificationStatus: verification.status,
    verificationLoading: verification.loading,
    onRefreshVerification: verification.refetch,
    businessId,
    businessAccountType: me?.business?.account_type,
    actionsNeededItems,
    actionsNeededTotal,
    dismissAllActionsNeeded,
    showIdReviewCard,
    showMobilePaymentPhoneCta,
    mobilePaymentPhoneCtaVariant,
    phoneReminderVariant,
    onDismissMobilePaymentPhoneReminder,
    onOpenMobilePaymentPhoneVerify,
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
    readinessSteps: setupMode ? [] : readinessSteps,
    merchantTip: quietHomeMode ? null : merchantTip,
    onReadinessStepPress,
    onMerchantTipAction,
    onMerchantTipDismiss,
    activeOrders: activeOrdersState.orders,
    activeOrdersCount: activeOrdersState.activeCount,
    onOpenActiveOrder: openActiveOrder,
    onActiveOrderCta,
    activeOrderCtaOrder,
    activeOrderCtaRequestId,
    onActiveOrderCtaSuccess,
  };
}
