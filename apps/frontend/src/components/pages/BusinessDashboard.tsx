import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useAiImageCleanup } from '../../hooks/useAiImageCleanup';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import { useLocationTransfers } from '../../hooks/useLocationTransfers';
import AiImageCleanupPendingCard from '../business/AiImageCleanupPendingCard';
import LocationTransferPendingCard from '../business/LocationTransferPendingCard';
import BusinessDashboardFirstItemCta from '../business/BusinessDashboardFirstItemCta';
import BusinessPreviewStoreCta from '../business/BusinessPreviewStoreCta';
import { BusinessClientsHero } from '../business/BusinessClientsHero';
import { BusinessGetReadyChecklist } from '../business/BusinessGetReadyChecklist';
import { BusinessVerificationBanner } from '../business/BusinessVerificationBanner';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from '../business/BusinessDashboardModuleCard';
import BusinessDashboardSection from '../business/BusinessDashboardSection';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import { MerchantStatusChip } from '../business/MerchantStatusChip';
import { useBusinessVerification } from '../../hooks/useBusinessVerification';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';
import { BusinessAccountCard } from '../business/BusinessAccountCard';

const DASHBOARD_ACCOUNT_PREVIEW_LIMIT = 2;

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { accounts } = useAccountInfo();
  const { getPending } = useAiImageCleanup();
  const previewAccounts = accounts.slice(0, DASHBOARD_ACCOUNT_PREVIEW_LIMIT);
  const hasMoreAccounts = accounts.length > DASHBOARD_ACCOUNT_PREVIEW_LIMIT;
  const {
    aggregates,
    loading: aggregatesLoading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);
  const { status: verificationStatus } = useBusinessVerification(!!profile?.business?.id);

  const [cleanupPendingCount, setCleanupPendingCount] = useState(0);
  const [cleanupPendingJobId, setCleanupPendingJobId] = useState<string | null>(null);
  const [cleanupPendingItemName, setCleanupPendingItemName] = useState<string | undefined>();

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
  }, [loadCleanupPending, profile?.business?.id]);

  const { incoming: incomingTransfers, fetchPending: fetchPendingTransfers } =
    useLocationTransfers(profile?.business?.id);

  useEffect(() => {
    if (!profile?.business?.id) return;
    void fetchPendingTransfers();
  }, [fetchPendingTransfers, profile?.business?.id]);

  const mainInterest =
    profile?.business?.main_interest ?? 'sell_items';
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
    !isLoading && mainInterest === 'sell_items' && itemCount === 0;
  const showFirstRentalCta =
    !isLoading && mainInterest === 'rent_items' && rentalItemCount === 0;

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
          {hasAdminAccess && (
            <StatusBadge type="admin" />
          )}
        </Box>
      </Box>

      <BusinessClientsHero
        count={
          aggregatesError ? null : (aggregates?.uniqueClientCount ?? null)
        }
        loading={isLoading}
        onClick={() => navigate('/business/client-cities')}
      />

      <BusinessVerificationBanner />

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

      <BusinessGetReadyChecklist
        status={verificationStatus}
        mainInterest={mainInterest}
        itemCount={itemCount}
        rentalItemCount={rentalItemCount}
        businessId={profile.business.id}
      />

      <BusinessPreviewStoreCta businessId={profile.business.id} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {accounts.length > 0 && (
          <Grid item xs={12} md={accounts.length > 0 ? 8 : 12}>
            <Box>
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
              {hasMoreAccounts && (
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
              )}
            </Box>
          </Grid>
        )}
        <Grid item xs={12} md={accounts.length > 0 ? 4 : 12}>
          <BusinessAccountCard />
        </Grid>
      </Grid>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.dashboard.subtitleSimplified',
          'Manage orders, reconcile cash payments, and resolve delivery issues. Use catalog tools for your products and locations.'
        )}
      </Typography>

      {showFirstSaleCta && <BusinessDashboardFirstItemCta variant="sale" />}
      {showFirstRentalCta && (
        <BusinessDashboardFirstItemCta variant="rental" />
      )}

      <AddressAlert />

      {aggregatesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      )}

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
      </BusinessDashboardSection>

      {hasAdminAccess && (
        <BusinessDashboardSection
          title={t('business.dashboard.adminManagement')}
          subtitle={t(
            'business.dashboard.adminSectionHint',
            'Platform administration in one place.'
          )}
        >
          {renderModules([adminHubModule])}
        </BusinessDashboardSection>
      )}
    </Container>
  );
};

export default BusinessDashboard;
