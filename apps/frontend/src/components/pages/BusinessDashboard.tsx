import {
  Alert,
  Box,
  Container,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAiImageCleanup } from '../../hooks/useAiImageCleanup';
import { useImageEnhancements } from '../../hooks/useImageEnhancements';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import { useLocationTransfers } from '../../hooks/useLocationTransfers';
import AiImageCleanupPendingCard from '../business/AiImageCleanupPendingCard';
import LocationTransferPendingCard from '../business/LocationTransferPendingCard';
import BusinessPreviewStoreCta from '../business/BusinessPreviewStoreCta';
import { BusinessTopViewedProducts } from '../business/BusinessTopViewedProducts';
import BusinessReferralCodeCard from '../business/BusinessReferralCodeCard';
import { BusinessGoLiveCelebration } from '../business/BusinessGoLiveCelebration';
import LaunchPromoBanner from '../business/LaunchPromoBanner';
import { BusinessSetupHome } from '../business/BusinessSetupHome';
import { BusinessVerificationBanner } from '../business/BusinessVerificationBanner';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from '../business/BusinessDashboardModuleCard';
import BusinessDashboardSection from '../business/BusinessDashboardSection';
import BusinessStoreReachCard from '../business/BusinessStoreReachCard';
import BusinessCatalogHealthCard from '../business/BusinessCatalogHealthCard';
import BusinessQuietHomeNextActionCard from '../business/BusinessQuietHomeNextActionCard';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import { MerchantStatusChip } from '../business/MerchantStatusChip';
import { useApiClient } from '../../hooks/useApiClient';
import { useBusinessVerification } from '../../hooks/useBusinessVerification';
import {
  isSetupMode,
  markGoLiveCelebrated,
  shouldShowGoLiveCelebration,
} from '../../utils/businessSetup';
import { resolveCatalogHealth } from '../../utils/catalogHealth';
import { resolveQuietHomeNextAction } from '../../utils/resolveQuietHomeNextAction';
import ReferralPayoutSnapshot from '../common/ReferralPayoutSnapshot';
import AssistantHomeEntry from '../common/AssistantHomeEntry';
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { getPending } = useAiImageCleanup();
  const { hydrateActivity } = useImageEnhancements();
  const {
    aggregates,
    loading: aggregatesLoading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);
  const apiClient = useApiClient();
  const {
    status: verificationStatus,
    loading: verificationLoading,
    refresh: refreshVerification,
  } = useBusinessVerification(!!profile?.business?.id);
  const setupMode = isSetupMode(verificationStatus);
  const showOperationalModules = !verificationLoading && !setupMode;
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const goLiveDismissedRef = useRef(false);
  const canAcceptOrders = verificationStatus?.can_accept_orders === true;

  const handleSetupRefresh = useCallback(async () => {
    try {
      await apiClient.post('/business-contracts/refresh');
    } catch {
      // Status refresh still useful if contract refresh fails.
    }
    await refreshVerification();
  }, [apiClient, refreshVerification]);

  const [cleanupPendingCount, setCleanupPendingCount] = useState(0);
  const [cleanupPendingJobId, setCleanupPendingJobId] = useState<string | null>(
    null
  );
  const [cleanupPendingItemName, setCleanupPendingItemName] = useState<
    string | undefined
  >();

  const loadCleanupPending = useCallback(async () => {
    try {
      const data = await getPending();
      const jobs = data.jobs ?? [];
      setCleanupPendingCount(data.pendingResultCount ?? 0);
      setCleanupPendingJobId(jobs[0]?.id ?? null);
      setCleanupPendingItemName(
        jobs[0]?.item_variant?.name ?? jobs[0]?.item?.name
      );
    } catch {
      setCleanupPendingCount(0);
      setCleanupPendingJobId(null);
      setCleanupPendingItemName(undefined);
    }
  }, [getPending]);

  useEffect(() => {
    if (!profile?.business?.id) return;
    void loadCleanupPending();
    void hydrateActivity();
  }, [hydrateActivity, loadCleanupPending, profile?.business?.id]);

  const prevBusinessIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const businessId = profile?.business?.id;
    if (businessId && businessId !== prevBusinessIdRef.current) {
      goLiveDismissedRef.current = false;
    }
    prevBusinessIdRef.current = businessId;
  }, [profile?.business?.id]);

  useEffect(() => {
    const businessId = profile?.business?.id;
    if (setupMode || !canAcceptOrders || !businessId) {
      if (!canAcceptOrders) setGoLiveOpen(false);
      return;
    }
    if (goLiveDismissedRef.current) return;
    setGoLiveOpen(shouldShowGoLiveCelebration(verificationStatus, businessId));
  }, [setupMode, canAcceptOrders, verificationStatus, profile?.business?.id]);

  const dismissGoLive = useCallback(() => {
    goLiveDismissedRef.current = true;
    setGoLiveOpen(false);
    const id = profile?.business?.id;
    if (id) markGoLiveCelebrated(id);
  }, [profile?.business?.id]);

  const { incoming: incomingTransfers, fetchPending: fetchPendingTransfers } =
    useLocationTransfers(profile?.business?.id);

  useEffect(() => {
    if (!profile?.business?.id) return;
    void fetchPendingTransfers();
  }, [fetchPendingTransfers, profile?.business?.id]);

  const mainInterest = profile?.business?.main_interest ?? 'sell_items';
  const isRentalFocused = mainInterest === 'rent_items';
  const isLoading = aggregatesLoading;
  const itemCount = aggregates?.itemCount ?? 0;
  const rentalItemCount = aggregates?.rentalItemCount ?? 0;
  const ordersTotal = aggregates?.ordersTotal ?? 0;
  const aggregatesReady = !aggregatesLoading && !!aggregates && !aggregatesError;
  const quietHomeMode =
    showOperationalModules && aggregatesReady && ordersTotal === 0;
  // Show day-to-day modules whenever we are not in quiet home (incl. loading/error).
  const fulfillmentMode = showOperationalModules && !quietHomeMode;

  const {
    primaryOrderModules,
    moreHubModule,
    primaryCatalogModules,
    catalogMenuHubModule,
    adminHubModule,
    hasAdminAccess,
    rentalModules,
  } = useBusinessDashboardModules({ aggregates, isRentalFocused });

  const quietCatalogModules = useMemo(() => {
    const locations = primaryCatalogModules.filter((m) =>
      m.path.includes('location')
    );
    const rentalCatalog = rentalModules.filter((m) =>
      m.path.includes('/rentals/catalog')
    );
    const saleItems = primaryCatalogModules.filter(
      (m) =>
        m.path.includes('/business/items') || m.path === '/business/items'
    );
    const secondaryCount = isRentalFocused
      ? aggregates?.itemCount ?? 0
      : aggregates?.rentalItemCount ?? 0;
    const primary = isRentalFocused ? rentalCatalog : saleItems;
    const secondary =
      secondaryCount > 0
        ? isRentalFocused
          ? saleItems
          : rentalCatalog
        : [];
    const picked = [...primary, ...secondary, ...locations];
    return picked.length > 0
      ? picked
      : isRentalFocused
        ? [...rentalModules.slice(0, 1), ...locations]
        : primaryCatalogModules.slice(0, 2);
  }, [
    primaryCatalogModules,
    rentalModules,
    isRentalFocused,
    aggregates?.itemCount,
    aggregates?.rentalItemCount,
  ]);

  const catalogHealth = useMemo(
    () => resolveCatalogHealth(aggregates, mainInterest),
    [aggregates, mainInterest]
  );

  const showIdReview =
    verificationStatus?.paymentRail === 'mobile_money' &&
    !!verificationStatus.steps.identity &&
    verificationStatus.steps.identity.status !== 'approved' &&
    verificationStatus.steps.identity.status !== 'missing';

  const showMmPhoneConfirm =
    verificationStatus?.paymentRail === 'mobile_money' &&
    verificationStatus.can_accept_orders === true &&
    (() => {
      const phone = verificationStatus.steps.mobilePaymentPhone;
      const needing =
        phone?.locationsWithItemsNeedingPhone ??
        phone?.locationCountNeedingPhone ??
        0;
      return needing > 0;
    })();

  const quietNextAction = useMemo(() => {
    if (!quietHomeMode) return null;
    return resolveQuietHomeNextAction({
      aggregates,
      verification: verificationStatus,
      mainInterest,
      showIdReview,
      showMmPhoneConfirm,
    });
  }, [
    quietHomeMode,
    aggregates,
    verificationStatus,
    mainInterest,
    showIdReview,
    showMmPhoneConfirm,
  ]);

  const onCatalogHealthPrimary = useCallback(() => {
    const primary = catalogHealth.primary;
    if (primary === 'fix_rejected') {
      navigate(
        isRentalFocused
          ? '/business/rentals/catalog?moderation=rejected'
          : '/business/items?moderation=rejected'
      );
      return;
    }
    if (primary === 'restock' || primary === 'manage') {
      navigate(isRentalFocused ? '/business/rentals/catalog' : '/business/items');
      return;
    }
    navigate(
      isRentalFocused
        ? '/business/onboarding/add-rental-item'
        : '/business/onboarding/first-sale-item'
    );
  }, [catalogHealth.primary, isRentalFocused, navigate]);

  const onQuietNextAction = useCallback(() => {
    if (!quietNextAction) return;
    const id = quietNextAction.id;
    if (id === 'cannot_accept_orders') {
      const next = verificationStatus?.nextAction;
      if (next === 'upload_id') {
        navigate('/business/documents');
        return;
      }
      if (next === 'verify_mobile_payment_phone') {
        navigate('/business/locations');
        return;
      }
      if (next === 'setup_stripe_connect') {
        navigate('/business/payments');
        return;
      }
      void handleSetupRefresh();
      return;
    }
    if (id === 'id_review') {
      navigate('/business/documents');
      return;
    }
    if (id === 'confirm_mm_phone') {
      navigate('/business/locations');
      return;
    }
    if (id === 'fix_rejected') {
      navigate(
        isRentalFocused
          ? '/business/rentals/catalog?moderation=rejected'
          : '/business/items?moderation=rejected'
      );
      return;
    }
    if (id === 'restock' || id === 'pending_moderation') {
      navigate(isRentalFocused ? '/business/rentals/catalog' : '/business/items');
      return;
    }
    if (id === 'catalog_goal') {
      navigate(
        isRentalFocused
          ? '/business/onboarding/add-rental-item'
          : '/business/onboarding/first-sale-item'
      );
      return;
    }
    if (id === 'logo' || id === 'hours') {
      navigate('/business/locations');
      return;
    }
    if (id === 'share_store' && profile?.business?.id) {
      navigate(`/store/${profile.business.id}?preview=1`);
      return;
    }
    if (id === 'offer_rentals') {
      navigate('/business/rentals/catalog');
      return;
    }
    if (id === 'offer_sale_items') {
      navigate('/business/items');
    }
  }, [
    quietNextAction,
    verificationStatus,
    navigate,
    handleSetupRefresh,
    isRentalFocused,
    profile?.business?.id,
  ]);

  const renderModules = (modules: BusinessDashboardModule[]) =>
    modules.map((mod) => (
      <BusinessDashboardModuleCard
        key={mod.path}
        module={mod}
        isLoading={isLoading}
      />
    ));

  const topViewed =
    aggregatesError || !aggregates?.topViewedProducts?.length
      ? []
      : aggregates.topViewedProducts;

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6" color="text.secondary">
            {t('business.dashboard.noBusinessProfile')}
          </Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-dashboard.title')}
        description={t('seo.business-dashboard.description')}
        keywords={t('seo.business-dashboard.keywords')}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          {t('business.dashboard.welcome', { name: profile.business.name })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <MerchantStatusChip
            lifecycleStatus={verificationStatus?.lifecycle_status}
            canAcceptOrders={verificationStatus?.can_accept_orders}
            isStorefrontVisible={verificationStatus?.is_storefront_visible}
          />
          {hasAdminAccess && <StatusBadge type="admin" />}
        </Box>
      </Box>

      {setupMode && verificationStatus ? (
        <BusinessSetupHome
          status={verificationStatus}
          mainInterest={mainInterest}
          businessId={profile.business.id}
          hasAnyItem={
            mainInterest === 'rent_items'
              ? rentalItemCount > 0
              : itemCount > 0
          }
          onRefresh={handleSetupRefresh}
        />
      ) : null}

      {showOperationalModules ? (
        <>
          <BusinessStoreReachCard
            businessId={profile.business.id}
            businessName={profile.business.name}
            productViews={
              aggregatesError ? null : (aggregates?.totalProductViews ?? null)
            }
            metricsLoading={isLoading}
            compact={fulfillmentMode}
          />
          {aggregatesReady ? (
            <BusinessCatalogHealthCard
              health={catalogHealth}
              compact={fulfillmentMode}
              onPrimary={onCatalogHealthPrimary}
            />
          ) : null}
        </>
      ) : null}

      {quietHomeMode && quietNextAction ? (
        <BusinessQuietHomeNextActionCard
          action={quietNextAction}
          onAction={onQuietNextAction}
        />
      ) : null}

      <AssistantHomeEntry />

      {!setupMode && !verificationLoading && !quietHomeMode ? (
        <BusinessVerificationBanner />
      ) : null}

      {fulfillmentMode && topViewed.length > 0 ? (
        <BusinessTopViewedProducts
          products={topViewed}
          loading={isLoading}
          onProductClick={(product) => {
            if (!product.itemId) return;
            navigate(`/business/items/${product.itemId}`);
          }}
        />
      ) : null}

      <LocationTransferPendingCard
        pendingCount={incomingTransfers.length}
        fromBusinessName={incomingTransfers[0]?.from_business?.name}
        onClick={() => {
          const first = incomingTransfers[0];
          navigate(
            first
              ? `/business/locations?transferRequestId=${first.id}`
              : '/business/locations'
          );
        }}
      />

      <AiImageCleanupPendingCard
        pendingCount={cleanupPendingCount}
        itemName={cleanupPendingItemName}
        onClick={() => {
          if (!cleanupPendingJobId) return;
          navigate(`/business/items/ai-image-cleanup/${cleanupPendingJobId}`);
        }}
      />

      <AddressAlert />

      {aggregatesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      ) : null}

      {quietHomeMode ? (
        <BusinessDashboardSection
          title={t(
            'business.dashboard.sections.catalog',
            'Catalog & locations'
          )}
        >
          {renderModules(quietCatalogModules)}
        </BusinessDashboardSection>
      ) : null}

      {fulfillmentMode ? (
        <>
          <BusinessDashboardSection
            title={t(
              'business.dashboard.sections.ordersAndDelivery',
              'Orders & delivery'
            )}
            subtitle={t(
              'business.dashboard.sections.ordersPrimaryHint',
              'Your day-to-day order workflows.'
            )}
          >
            {renderModules([...primaryOrderModules, moreHubModule])}
          </BusinessDashboardSection>
          <BusinessDashboardSection
            title={t(
              'business.dashboard.sections.catalog',
              'Catalog & locations'
            )}
            subtitle={t(
              'business.dashboard.sections.catalogPrimaryHint',
              'Products and where you sell from.'
            )}
          >
            {renderModules([...primaryCatalogModules, catalogMenuHubModule])}
            <BusinessPreviewStoreCta businessId={profile.business.id} />
          </BusinessDashboardSection>
        </>
      ) : null}

      {setupMode &&
      (verificationStatus?.steps.catalog?.hasApprovedItem ||
        verificationStatus?.steps.catalog?.hasPendingItem ||
        verificationStatus?.steps.catalog?.hasApprovedRental ||
        verificationStatus?.steps.catalog?.hasPendingRental) ? (
        <Box sx={{ mb: 2 }}>
          <BusinessPreviewStoreCta businessId={profile.business.id} />
        </Box>
      ) : null}

      {showOperationalModules ? (
        <Box sx={{ mb: 2 }}>
          <ReferralPayoutSnapshot
            source="business"
            walletPath="/business/accounts"
          />
        </Box>
      ) : null}

      <Box sx={{ mb: 2 }}>
        <LaunchPromoBanner />
      </Box>

      {hasAdminAccess ? (
        <BusinessDashboardSection
          title={t('business.dashboard.adminManagement')}
          subtitle={t(
            'business.dashboard.adminSectionHint',
            'Platform administration in one place.'
          )}
        >
          {renderModules([adminHubModule])}
        </BusinessDashboardSection>
      ) : null}

      <Box sx={{ mb: 2 }}>
        <BusinessReferralCodeCard />
      </Box>

      <BusinessGoLiveCelebration
        open={goLiveOpen}
        businessId={profile.business.id}
        mainInterest={mainInterest}
        onDismiss={dismissGoLive}
      />
    </Container>
  );
};

export default BusinessDashboard;
