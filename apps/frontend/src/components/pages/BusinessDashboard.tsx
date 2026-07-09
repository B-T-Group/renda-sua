import {
  Alert,
  Box,
  Button,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import BusinessDashboardFirstItemCta from '../business/BusinessDashboardFirstItemCta';
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

const DASHBOARD_ACCOUNT_PREVIEW_LIMIT = 2;

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { accounts } = useAccountInfo();
  const previewAccounts = accounts.slice(0, DASHBOARD_ACCOUNT_PREVIEW_LIMIT);
  const hasMoreAccounts = accounts.length > DASHBOARD_ACCOUNT_PREVIEW_LIMIT;
  const {
    aggregates,
    loading: aggregatesLoading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);
  const { status: verificationStatus } = useBusinessVerification(!!profile?.business?.id);

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
          {profile.business.is_admin && <StatusBadge type="admin" />}
        </Box>
      </Box>

      <BusinessVerificationBanner />

      <BusinessGetReadyChecklist
        status={verificationStatus}
        mainInterest={mainInterest}
        itemCount={itemCount}
        rentalItemCount={rentalItemCount}
      />

      {accounts.length > 0 && (
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
      )}

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

      {profile.business.is_admin && (
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
