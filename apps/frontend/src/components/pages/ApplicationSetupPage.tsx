import {
  Alert,
  Box,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
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
  const [section, setSection] = useState<'country' | 'app' | 'slots'>(
    'country'
  );
  const [stateFilter, setStateFilter] = useState<string>('all');

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

  const states = useMemo(() => {
    if (!setup) return [];
    const raw = setup.delivery_time_slots
      .map((slot) => slot.state)
      .filter((state): state is string => !!state && state.trim() !== '');
    return Array.from(new Set(raw));
  }, [setup]);

  useEffect(() => {
    if (!states.length) {
      setStateFilter('all');
    } else if (stateFilter !== 'all' && !states.includes(stateFilter)) {
      setStateFilter('all');
    }
  }, [states, stateFilter]);

  const selectedCountry = countries.find(
    (country) => country.code === countryCode
  );

  const summaryStateLabel =
    stateFilter === 'all'
      ? t('admin.applicationSetup.allStates', 'All states / provinces')
      : stateFilter;

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
  const filteredSlots =
    setup && stateFilter !== 'all'
      ? setup.delivery_time_slots.filter(
          (slot) => (slot.state || '') === stateFilter
        )
      : setup?.delivery_time_slots || [];

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

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>
              {t('admin.applicationSetup.countryLabel', 'Country')}
            </InputLabel>
            <Select
              label={t('admin.applicationSetup.countryLabel', 'Country')}
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value as string)}
            >
              {countries.map((country) => (
                <MenuItem key={country.code} value={country.code}>
                  {country.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {states.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>
                {t('admin.applicationSetup.state', 'State/Province')}
              </InputLabel>
              <Select
                label={t('admin.applicationSetup.state', 'State/Province')}
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value as string)
                }
              >
                <MenuItem value="all">
                  {t(
                    'admin.applicationSetup.allStates',
                    'All states / provinces'
                  )}
                </MenuItem>
                {states.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary">
          {t(
            'admin.applicationSetup.filterSummary',
            'Configuring: {{country}} · {{state}}',
            {
              country: selectedCountry?.name || countryCode,
              state: summaryStateLabel,
            }
          )}
        </Typography>
      </Box>

      {loading && <LoadingScreen open />}

      {error && !loading && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {setup && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
          }}
        >
          <Box sx={{ width: { xs: '100%', md: 260 } }}>
            <Tabs
              orientation="vertical"
              value={section}
              onChange={(_, next) => setSection(next)}
              variant="scrollable"
            >
              <Tab
                value="country"
                label={t(
                  'admin.applicationSetup.tabCountryConfigs',
                  'Country delivery configs'
                )}
              />
              <Tab
                value="app"
                label={t(
                  'admin.applicationSetup.tabAppConfigs',
                  'Application configurations'
                )}
              />
              <Tab
                value="slots"
                label={t(
                  'admin.applicationSetup.tabTimeSlots',
                  'Delivery time slots'
                )}
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1 }}>
            {section === 'country' && (
              <CountryDeliveryConfigsSection
                countryCode={countryCode}
                countryConfigs={setup.country_delivery_configs}
                deliveryConfigs={setup.delivery_configs}
                cancellationConfig={cancellationConfig}
              />
            )}

            {section === 'app' && (
              <ApplicationConfigurationsSection config={cancellationConfig} />
            )}

            {section === 'slots' && (
              <DeliveryTimeSlotsSection
                slots={filteredSlots}
                stateFilter={stateFilter}
              />
            )}
          </Box>

          <Box
            sx={{
              width: { xs: '100%', md: 280 },
              display: { xs: 'none', md: 'block' },
            }}
          >
            {/* Summary card placeholder for future enhancements */}
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default ApplicationSetupPage;
