import {
  Alert,
  AlertTitle,
  Box,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import BusinessDashboardFirstItemCta from '../business/BusinessDashboardFirstItemCta';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from '../business/BusinessDashboardModuleCard';
import BusinessDashboardSection from '../business/BusinessDashboardSection';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { accounts } = useAccountInfo();
  const {
    aggregates,
    loading: aggregatesLoading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);

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
          {profile.business.is_verified && <StatusBadge type="verified" />}
          {profile.business.is_admin && <StatusBadge type="admin" />}
        </Box>
      </Box>

      {!profile.business.is_verified && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>
            {t(
              'business.dashboard.verificationNoticeTitle',
              'Account verification required'
            )}
          </AlertTitle>
          <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
            {t(
              'business.dashboard.verificationNotice',
              'Your business account must be verified by Rendasua head office before your items can be visible to customers on the platform. You can continue to manage your catalog and settings; we will notify you when your account has been verified.'
            )}
          </Typography>
        </Alert>
      )}

      {accounts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {t('accounts.accountInformation')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {accounts.map((account) => (
              <UserAccount
                key={account.id}
                accountId={account.id}
                compactView={true}
                showTransactions={false}
              />
            ))}
          </Box>
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
