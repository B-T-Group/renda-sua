import { Box, Container, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { ConfigurationManagement } from '../admin/ConfigurationManagement';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const AdminConfigurationPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loading, error } = useUserProfileContext();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          {t('common.error', 'Error')}: {error}
        </Typography>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          {t(
            'admin.configurations.noBusinessProfile',
            'Business profile not found'
          )}
        </Typography>
      </Container>
    );
  }

  if (!profile.business.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          {t(
            'admin.configurations.unauthorized',
            'You are not authorized to access this page'
          )}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('admin.configurations.pageTitle', 'Configuration Management')}
        description={t(
          'admin.configurations.pageDescription',
          'Manage application configurations and settings'
        )}
        keywords={t(
          'admin.configurations.pageKeywords',
          'admin, configuration, settings, management'
        )}
      />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('admin.configurations.pageTitle', 'Configuration Management')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t(
            'admin.configurations.pageDescription',
            'Manage application configurations and settings'
          )}
        </Typography>
      </Box>

      <ConfigurationManagement />
    </Container>
  );
};

export default AdminConfigurationPage;
