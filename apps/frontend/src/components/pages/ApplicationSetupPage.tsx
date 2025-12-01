import { Alert, Box, Container, Tab, Tabs, Typography } from '@mui/material';
import { Country } from 'country-state-city';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApplicationSetup } from '../../hooks/useApplicationSetup';
import { ApplicationConfigurationsSection } from '../admin/ApplicationConfigurationsSection';
import { CountryDeliveryConfigsSection } from '../admin/CountryDeliveryConfigsSection';
import { DeliveryTimeSlotsSection } from '../admin/DeliveryTimeSlotsSection';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const ApplicationSetupPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfileContext();
  const { setup, loading, error, fetchSetup } = useApplicationSetup();
  const [countryCode, setCountryCode] = useState<string>('GA');
  const [tab, setTab] = useState(0);

  const isBusinessAdmin =
    !!profile?.business && profile.business.is_admin === true;

  useEffect(() => {
    fetchSetup(countryCode);
  }, [countryCode, fetchSetup]);

  const countries = useMemo(() => {
    const allowed = ['GA', 'CM', 'CA'];
    return Country.getAllCountries()
      .filter((country) => allowed.includes(country.isoCode))
      .map((country) => ({
        code: country.isoCode,
        name: country.name,
      }));
  }, []);

  if (profileLoading) {
    return <LoadingScreen open />;
  }

  if (profileError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('common.error', 'Error')}: {profileError}
        </Alert>
      </Container>
    );
  }

  if (!isBusinessAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t(
            'admin.applicationSetup.unauthorized',
            'You are not authorized to access the application setup page.'
          )}
        </Alert>
      </Container>
    );
  }

  const cancellationConfig = setup?.application_configurations?.[0] || null;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('admin.applicationSetup.pageTitle', 'Application setup')}
        description={t(
          'admin.applicationSetup.pageDescription',
          'Configure delivery settings and application parameters for your country.'
        )}
        keywords={t(
          'admin.applicationSetup.pageKeywords',
          'admin, application, setup, configuration, delivery'
        )}
      />

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('admin.applicationSetup.pageTitle', 'Application setup')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t(
            'admin.applicationSetup.pageSubtitle',
            'Review and manage key delivery and application configurations before going live.'
          )}
        </Typography>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 260 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('admin.applicationSetup.countryLabel', 'Country')}
          </Typography>
          <Tabs
            value={countryCode}
            onChange={(_, code) => setCountryCode(code)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {countries.map((country) => (
              <Tab
                key={country.code}
                value={country.code}
                label={country.name}
              />
            ))}
          </Tabs>
        </Box>
      </Box>

      {loading && <LoadingScreen open />}

      {error && !loading && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {setup && (
        <Box>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
            <Tab
              label={t(
                'admin.applicationSetup.tabCountryConfigs',
                'Country delivery configs'
              )}
            />
            <Tab
              label={t(
                'admin.applicationSetup.tabAppConfigs',
                'Application configurations'
              )}
            />
            <Tab
              label={t(
                'admin.applicationSetup.tabTimeSlots',
                'Delivery time slots'
              )}
            />
          </Tabs>

          {tab === 0 && (
            <CountryDeliveryConfigsSection
              countryCode={countryCode}
              countryConfigs={setup.country_delivery_configs}
              deliveryConfigs={setup.delivery_configs}
              cancellationConfig={cancellationConfig}
            />
          )}

          {tab === 1 && (
            <ApplicationConfigurationsSection config={cancellationConfig} />
          )}

          {tab === 2 && (
            <DeliveryTimeSlotsSection slots={setup.delivery_time_slots} />
          )}
        </Box>
      )}
    </Container>
  );
};

export default ApplicationSetupPage;
