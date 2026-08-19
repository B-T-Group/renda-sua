import {
  Alert,
  Box,
  Button,
  Container,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useAiImageCleanup } from '../../hooks/useAiImageCleanup';
import { useImageEnhancements } from '../../hooks/useImageEnhancements';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import { useLocationTransfers } from '../../hooks/useLocationTransfers';
import AiImageCleanupPendingCard from '../business/AiImageCleanupPendingCard';
import LocationTransferPendingCard from '../business/LocationTransferPendingCard';
import BusinessDashboardFirstItemCta from '../business/BusinessDashboardFirstItemCta';
import BusinessPreviewStoreCta from '../business/BusinessPreviewStoreCta';
import { BusinessExcitementStats } from '../business/BusinessExcitementStats';
import { BusinessTopViewedProducts } from '../business/BusinessTopViewedProducts';
import { BusinessAccountTypeLink } from '../business/BusinessAccountTypeLink';
import BusinessReferralCodeCard from '../business/BusinessReferralCodeCard';
import { BusinessGoLiveCelebration } from '../business/BusinessGoLiveCelebration';
import LaunchPromoBanner from '../business/LaunchPromoBanner';
import { BusinessSetupHome } from '../business/BusinessSetupHome';
import { BusinessVerificationBanner } from '../business/BusinessVerificationBanner';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from '../business/BusinessDashboardModuleCard';
import BusinessDashboardSection from '../business/BusinessDashboardSection';
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
import UserAccount from '../common/UserAccount';
import ReferralPayoutSnapshot from '../common/ReferralPayoutSnapshot';
import SEOHead from '../seo/SEOHead';

const DASHBOARD_ACCOUNT_PREVIEW_LIMIT = 2;

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { accounts } = useAccountInfo();
  const { getPending } = useAiImageCleanup();
  const { hydrateActivity } = useImageEnhancements();
  const previewAccounts = accounts.slice(0, DASHBOARD_ACCOUNT_PREVIEW_LIMIT);
  const hasMoreAccounts = accounts.length > DASHBOARD_ACCOUNT_PREVIEW_LIMIT;
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
  // Avoid flashing operational modules before verification status resolves.
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

  const {
    primaryOrderModules,
    moreHubModule,
    primaryCatalogModules,
    catalogMenuHubModule,
    adminHubModule,
    hasAdminAccess,
  } = useBusinessDashboardModules({ aggregates, isRentalFocused });

  const showFirstSaleCta =
    showOperationalModules &&
    !isLoading &&
    mainInterest === 'sell_items' &&
    itemCount === 0;
  const showFirstRentalCta =
    showOperationalModules &&
    !isLoading &&
    mainInterest === 'rent_items' &&
    rentalItemCount === 0;

  const renderModules = (modules: BusinessDashboardModule[]) =>
    modules.map((mod) => (
      <BusinessDashboardModuleCard
        key={mod.path}
        module={mod}
        isLoading={isLoading}
      />
    ));

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
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

      <ReferralPayoutSnapshot source="business" walletPath="/business/accounts" />

      {showOperationalModules ? <BusinessAccountTypeLink /> : null}

      {showOperationalModules ? (
        <BusinessExcitementStats
          clientCount={
            aggregatesError ? null : (aggregates?.uniqueClientCount ?? null)
          }
          productViews={
            aggregatesError ? null : (aggregates?.totalProductViews ?? null)
          }
          productViewsLast7d={
            aggregatesError ? null : (aggregates?.productViewsLast7d ?? null)
          }
          loading={isLoading}
          onClientsClick={() => navigate('/business/client-cities')}
        />
      ) : null}

      {showOperationalModules ? (
        <BusinessTopViewedProducts
          products={
            aggregatesError ? [] : (aggregates?.topViewedProducts ?? [])
          }
          loading={isLoading}
          onProductClick={(product) => {
            if (!product.itemId) return;
            navigate(`/business/items/${product.itemId}`);
          }}
        />
      ) : null}

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
      ) : !verificationLoading ? (
        <BusinessVerificationBanner />
      ) : null}

      <Box sx={{ mb: 2 }}>
        <LaunchPromoBanner />
      </Box>

      <Box sx={{ mb: 2 }}>
        <BusinessReferralCodeCard />
      </Box>

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

      {showOperationalModules && accounts.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {t('accounts.accountInformation')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {previewAccounts.map((account) => (
              <UserAccount
                key={account.id}
                accountId={account.id}
                compactView={true}
                showTransactions={false}
              />
            ))}
          </Box>
          {hasMoreAccounts ? (
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/business/accounts')}
              sx={{ mt: 1.5 }}
            >
              {t('accounts.viewAllAccounts', 'View all {{count}} accounts', {
                count: accounts.length,
              })}
            </Button>
          ) : null}
        </Box>
      ) : null}

      {showOperationalModules ? (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'business.dashboard.subtitleSimplified',
            'Manage orders, reconcile cash payments, and resolve delivery issues. Use catalog tools for your products and locations.'
          )}
        </Typography>
      ) : null}

      {showFirstSaleCta ? (
        <BusinessDashboardFirstItemCta variant="sale" />
      ) : null}
      {showFirstRentalCta ? (
        <BusinessDashboardFirstItemCta variant="rental" />
      ) : null}

      <AddressAlert />

      {aggregatesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      ) : null}

      {showOperationalModules ? (
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
      ) : null}

      {showOperationalModules ? (
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
