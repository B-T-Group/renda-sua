import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { profile } = useUserProfileContext();
  const { isViewingOtherBusiness } = useBusinessCatalogScope();
  const { isStripeRail, loading: railLoading } = useIsStripeRail();
  const businessId = profile?.business?.id;
  const { locations, loading, updateLocation, deleteLocation } =
    useBusinessLocations(businessId);
  const location = selectBusinessLocation(locations, locationId);
  const [phoneRequest, setPhoneRequest] = useState(0);

  const update = async (id: string, data: UpdateBusinessLocationData) => {
    // auto_withdraw_commissions also gates Stripe Connect payouts. Section
    // saves (hours, name, visibility) must not turn that off.
    return updateLocation(id, data);
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
        phoneRequest,
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
    <Container
      maxWidth="md"
      sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, md: 4 }, maxWidth: 760 }}
    >
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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {location.name}
          </Typography>
          {address ? (
            <Typography variant="body2" color="text.secondary">
              {address}
            </Typography>
          ) : null}
        </Stack>
        <Button variant="text" onClick={actions.onManageItems}>
          {t('business.locations.manageItems', 'Manage items')}
        </Button>
      </Stack>
      <Stack spacing={2}>
        <LocationExpectationsCard
          location={location}
          isStripeRail={isStripeRail}
          hasVerifiedPhone={verified}
          onAction={(action) =>
            handleExpectationAction(action, {
              onManageItems: actions.onManageItems,
              showLocation: () => update(location.id, { is_active: true }),
              askForPhone: () => setPhoneRequest((current) => current + 1),
            })
          }
        />
        <OpenClosedSection
          {...actions}
          startEditing={searchParams.get('edit') === 'hours'}
        />
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

function handleExpectationAction(
  action: string,
  handlers: {
    onManageItems: () => void;
    showLocation: () => Promise<unknown>;
    askForPhone: () => void;
  }
) {
  if (action === 'manageItems') handlers.onManageItems();
  if (action === 'showLocation') void handlers.showLocation();
  if (action === 'verifyPhone' || action === 'addPhone') handlers.askForPhone();
}

export default BusinessLocationSettingsPage;
