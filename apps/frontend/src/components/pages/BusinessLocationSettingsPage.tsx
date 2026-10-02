import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessCatalogScope } from '../../hooks/useBusinessCatalogScope';
import {
  selectBusinessLocation,
  UpdateBusinessLocationData,
  useBusinessLocations,
} from '../../hooks/useBusinessLocations';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import BasicsSection from '../business/location-settings/BasicsSection';
import ForAllLocationsPanel from '../business/location-settings/ForAllLocationsPanel';
import GettingPaidSection from '../business/location-settings/GettingPaidSection';
import HowCustomersPaySection from '../business/location-settings/HowCustomersPaySection';
import LocationExpectationsCard from '../business/location-settings/LocationExpectationsCard';
import MoreOptionsSection from '../business/location-settings/MoreOptionsSection';
import OpenClosedSection from '../business/location-settings/OpenClosedSection';
import OrderAlertsSection from '../business/location-settings/OrderAlertsSection';
import { LocationSectionActions } from '../business/location-settings/sectionTypes';
import SEOHead from '../seo/SEOHead';

const BusinessLocationSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locationId } = useParams();
  const { profile } = useUserProfileContext();
  const { isViewingOtherBusiness } = useBusinessCatalogScope();
  const { isStripeRail, loading: railLoading } = useIsStripeRail();
  const businessId = profile?.business?.id;
  const { locations, loading, updateLocation, deleteLocation } =
    useBusinessLocations(businessId);
  const location = selectBusinessLocation(locations, locationId);

  const update = async (id: string, data: UpdateBusinessLocationData) => {
    const payload =
      isStripeRail && data.pay_at_confirm === undefined
        ? { ...data, auto_withdraw_commissions: false as const }
        : data;
    return updateLocation(id, payload);
  };

  const removeLocation = async (id: string) => {
    await deleteLocation(id);
    navigate('/business/locations');
  };

  const actions: LocationSectionActions | null = location
    ? {
        location,
        locations,
        businessId,
        isStripeRail,
        railLoading,
        isOwnBusiness: !isViewingOtherBusiness,
        updateLocation: update,
        deleteLocation: removeLocation,
        onManageItems: () => navigate(`/business/items?location=${location.id}`),
      }
    : null;

  if (loading && !location) {
    return (
      <Container maxWidth="md" sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!location || !actions) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          {t('business.locations.settings.notFound', "We couldn't find this location.")}
        </Alert>
      </Container>
    );
  }

  const verified = location.mobile_payment_phone?.is_verified === true;
  const address = [location.address?.address_line_1, location.address?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 }, maxWidth: 720 }}>
      <SEOHead
        title={location.name}
        description={t(
          'business.locations.settings.seo',
          'Location settings'
        )}
      />
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/business/locations')}
        sx={{ mb: 2 }}
      >
        {t('business.locations.title', 'Locations')}
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">
          {location.name}
          {address ? ` · ${address}` : ''}
        </Typography>
        <Button variant="text" onClick={actions.onManageItems}>
          {t('business.locations.manageItems', 'Manage items')}
        </Button>
      </Stack>
      <Stack spacing={2}>
        <LocationExpectationsCard
          location={location}
          isStripeRail={isStripeRail}
          hasVerifiedPhone={verified}
          onAction={(action) => {
            if (action === 'manageItems') actions.onManageItems();
            if (action === 'showLocation') {
              void update(location.id, { is_active: true });
            }
          }}
        />
        <OpenClosedSection {...actions} />
        <GettingPaidSection {...actions} updateLocation={update} />
        <HowCustomersPaySection {...actions} updateLocation={update} />
        <OrderAlertsSection {...actions} updateLocation={update} />
        <BasicsSection {...actions} updateLocation={update} />
        <MoreOptionsSection {...actions} updateLocation={update} />
        <ForAllLocationsPanel />
      </Stack>
    </Container>
  );
};

export default BusinessLocationSettingsPage;
