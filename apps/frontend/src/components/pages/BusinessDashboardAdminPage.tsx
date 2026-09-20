import { Alert, Box, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import AdminOverviewSection from '../admin/AdminOverviewSection';
import SEOHead from '../seo/SEOHead';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { groupAdminModules } from '../../constants/adminModuleSections';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';

export interface AdminToolsOutletContext {
  adminSearch: string;
  setAdminSearch: (value: string) => void;
}

const BusinessDashboardAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const outlet = useOutletContext<AdminToolsOutletContext | undefined>();
  const search = outlet?.adminSearch ?? '';

  const {
    aggregates,
    loading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);

  const isRentalFocused =
    (profile?.business?.main_interest ?? 'sell_items') === 'rent_items';
  const { adminModules } = useBusinessDashboardModules({
    aggregates,
    isRentalFocused,
  });

  const groups = useMemo(
    () => groupAdminModules(adminModules, search),
    [adminModules, search]
  );

  return (
    <Box>
      <SEOHead
        title={t('business.dashboard.adminPageSeoTitle', 'Admin tools')}
        description={t(
          'business.dashboard.adminPageSeoDescription',
          'Platform administration for Rendasua administrators.'
        )}
        keywords={t('seo.business-dashboard.keywords')}
      />

      <Typography variant="h5" gutterBottom>
        {t('business.dashboard.adminMenuTitle', 'Admin tools')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t(
          'business.dashboard.adminManagementHint',
          'Platform tools visible to administrators only.'
        )}
      </Typography>

      {aggregatesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      ) : null}

      {groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('business.dashboard.adminSearchEmpty', 'No tools match.')}
        </Typography>
      ) : (
        <Stack spacing={2.5}>
          {groups.map((group) => (
            <AdminOverviewSection
              key={group.section}
              group={group}
              loading={loading}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BusinessDashboardAdminPage;
