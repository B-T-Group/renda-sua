import { Add as AddIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessCatalogScope } from '../../hooks/useBusinessCatalogScope';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
  useBusinessLocations,
} from '../../hooks/useBusinessLocations';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useLocationTransfers } from '../../hooks/useLocationTransfers';
import LocationCard from '../business/LocationCard';
import LocationCardSkeleton from '../business/LocationCardSkeleton';
import ForAllLocationsPanel from '../business/location-settings/ForAllLocationsPanel';
import LocationModal from '../business/LocationModal';
import LocationTransferInbox from '../business/LocationTransferInbox';
import AddressDialog, { type AddressFormData } from '../dialogs/AddressDialog';
import SEOHead from '../seo/SEOHead';

const INITIAL_BUSINESS_ADDRESS_FORM: AddressFormData = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  address_type: 'home',
  is_primary: true,
};

const BusinessLocationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, refetch: refetchProfile, addAddress } =
    useUserProfileContext();
  const { businessQueryParams } = useBusinessCatalogScope();
  const { isStripeRail, loading: railLoading } = useIsStripeRail();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [businessAddressDialogOpen, setBusinessAddressDialogOpen] = useState(false);
  const [businessAddressForm, setBusinessAddressForm] = useState<AddressFormData>(
    () => ({ ...INITIAL_BUSINESS_ADDRESS_FORM })
  );
  const [savingBusinessAddress, setSavingBusinessAddress] = useState(false);
  const [transferRefresh, setTransferRefresh] = useState(0);
  const [deepLinkRequestId, setDeepLinkRequestId] = useState<string | null>(null);
  const { fetchPending } = useLocationTransfers(profile?.business?.id);

  useEffect(() => {
    const id = searchParams.get('transferRequestId');
    if (!id) return;
    setDeepLinkRequestId(id);
    const next = new URLSearchParams(searchParams);
    next.delete('transferRequestId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    locations,
    primaryAddressCountry,
    loading: locationsLoading,
    error: locationsError,
    warning: locationsWarning,
    addLocation,
    fetchLocations,
  } = useBusinessLocations(profile?.business?.id, undefined, refetchProfile);

  const canAddLocation = !!primaryAddressCountry;

  const openBusinessAddressDialog = useCallback(() => {
    setBusinessAddressForm({ ...INITIAL_BUSINESS_ADDRESS_FORM });
    setBusinessAddressDialogOpen(true);
  }, []);

  const saveBusinessAddress = useCallback(async () => {
    const businessId = profile?.business?.id;
    if (!businessId) return;
    const { address_line_1, city, country, state } = businessAddressForm;
    if (!address_line_1?.trim() || !city?.trim() || !country?.trim() || !state?.trim()) {
      enqueueSnackbar(
        t('addresses.addressDialog.requiredFields', 'Please fill in all required fields (address, city, state, country).'),
        { variant: 'warning' }
      );
      return;
    }
    setSavingBusinessAddress(true);
    try {
      const success = await addAddress(
        {
          ...businessAddressForm,
          address_line_1: address_line_1.trim(),
          address_line_2: businessAddressForm.address_line_2?.trim() || '',
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          postal_code: businessAddressForm.postal_code?.trim() || '',
          address_type: businessAddressForm.address_type || 'home',
          is_primary: true,
        },
        'business',
        businessId
      );
      if (success) {
        setBusinessAddressDialogOpen(false);
        await fetchLocations();
      }
    } finally {
      setSavingBusinessAddress(false);
    }
  }, [profile?.business?.id, businessAddressForm, addAddress, enqueueSnackbar, t, fetchLocations]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleViewItems = (location: BusinessLocation) => {
    const params = new URLSearchParams();
    if (businessQueryParams?.businessId) {
      params.set('businessId', businessQueryParams.businessId);
    }
    params.set('location', location.id);
    navigate(`/business/items?${params.toString()}`);
  };

  const handleSaveLocation = async (
    data: AddBusinessLocationData | UpdateBusinessLocationData
  ) => {
    let created: Awaited<ReturnType<typeof addLocation>>;
    try {
      created = await addLocation(data as AddBusinessLocationData);
    } catch {
      enqueueSnackbar(
        t('business.locations.saveError', 'Failed to save location'),
        { variant: 'error' }
      );
      return;
    }
    setShowLocationModal(false);
    enqueueSnackbar(
      t('business.locations.locationAdded', 'Location added. Set your opening hours'),
      {
        variant: 'success',
        action: (key) => (
          <Button
            color="inherit"
            onClick={() => {
              closeSnackbar(key);
              navigate(`/business/locations/${created.id}`);
            }}
          >
            {t('business.locations.hours.setNow', 'Set hours')}
          </Button>
        ),
      }
    );
  };

  if (profileLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile', 'Business profile not found')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={t('seo.business-locations.title', 'Business Locations')}
        description={t('seo.business-locations.description', 'Manage your business locations')}
        keywords={t('seo.business-locations.keywords', 'business locations, manage locations')}
      />
      <Box sx={{ mb: 3 }}>
        <Button variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
          {t('business.locations.backToDashboard', 'Back to dashboard')}
        </Button>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {t('business.locations.title', 'Locations')}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowLocationModal(true)} disabled={!canAddLocation}>
            {t('business.locations.addLocation', 'Add location')}
          </Button>
        </Stack>
        {!locationsLoading && !canAddLocation && profile.business ? (
          <Alert severity="info" sx={{ mt: 2 }} action={
            <Button color="inherit" size="small" onClick={openBusinessAddressDialog}>
              {t('business.locations.addBusinessAddress', 'Add business address')}
            </Button>
          }>
            {t('business.locations.addAddressFirst', 'Add a business address first before adding locations.')}
          </Alert>
        ) : null}
        <Box sx={{ mt: 2 }}>
          <LocationTransferInbox
            businessId={profile.business.id}
            refreshToken={transferRefresh}
            focusRequestId={deepLinkRequestId}
            onFocusHandled={() => setDeepLinkRequestId(null)}
            onChanged={() => {
              void fetchLocations();
              void fetchPending();
              setTransferRefresh((n) => n + 1);
            }}
          />
        </Box>
      </Box>
      {locationsError ? <Alert severity="error" sx={{ mb: 2 }}>{locationsError}</Alert> : null}
      {locationsLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map((index) => (
            <Grid size={{ xs: 12 }} key={index}><LocationCardSkeleton /></Grid>
          ))}
        </Grid>
      ) : null}
      {!locationsLoading && locations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            {t('business.locations.noLocations', 'No locations found')}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowLocationModal(true)} disabled={!canAddLocation}>
            {t('business.locations.addFirstLocation', 'Add First Location')}
          </Button>
        </Paper>
      ) : null}
      {!locationsLoading && locations.length > 0 ? (
        <Stack spacing={2}>
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              isStripeRail={isStripeRail}
              railLoading={railLoading}
              onSettings={(item) => navigate(`/business/locations/${item.id}`)}
              onViewItems={handleViewItems}
            />
          ))}
        </Stack>
      ) : null}
      <Box sx={{ mt: 3 }}>
        <ForAllLocationsPanel />
      </Box>
      <LocationModal
        open={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSave={handleSaveLocation}
        businessPrimaryCountry={primaryAddressCountry}
        businessId={profile.business.id}
        loading={locationsLoading}
        error={locationsError}
        warning={locationsWarning}
      />
      <AddressDialog
        open={businessAddressDialogOpen}
        onClose={() => {
          if (!savingBusinessAddress) setBusinessAddressDialogOpen(false);
        }}
        onSave={saveBusinessAddress}
        addressData={businessAddressForm}
        onAddressChange={setBusinessAddressForm}
        loading={savingBusinessAddress}
        title={t('business.locations.addBusinessAddress', 'Add business address')}
        fullScreen={isMobile}
      />
    </Container>
  );
};

export default BusinessLocationsPage;
