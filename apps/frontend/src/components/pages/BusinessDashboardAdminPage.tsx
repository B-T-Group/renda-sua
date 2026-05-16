import { Alert, Container, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import BusinessDashboardHubPage from '../business/BusinessDashboardHubPage';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';

const BusinessDashboardAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const {
    aggregates,
    loading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);

  const mainInterest =
    profile?.business?.main_interest ?? 'sell_items';
  const isRentalFocused = mainInterest === 'rent_items';
  const { adminModules } = useBusinessDashboardModules({
    aggregates,
    isRentalFocused,
  });

  if (!profile?.business?.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6" color="text.secondary">
            {t(
              'business.dashboard.adminAccessDenied',
              'You do not have access to admin tools.'
            )}
          </Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <BusinessDashboardHubPage
      seoTitleKey="business.dashboard.adminPageSeoTitle"
      seoTitleDefault="Admin tools"
      seoDescriptionKey="business.dashboard.adminPageSeoDescription"
      seoDescriptionDefault="Platform administration for Rendasua administrators."
      pageTitle={t('business.dashboard.adminMenuTitle', 'Admin tools')}
      pageSubtitle={t(
        'business.dashboard.adminManagementHint',
        'Platform tools visible to administrators only.'
      )}
      sections={[
        {
          title: t('business.dashboard.adminManagement'),
          modules: adminModules,
        },
      ]}
      isLoading={loading}
      error={aggregatesError}
    />
  );
};

export default BusinessDashboardAdminPage;
