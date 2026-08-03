import {
  HomeOutlined as HomeOutlinedIcon,
  LocationCity as LocationCityIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCountryStateCity } from '../../../hooks/useCountryStateCity';
import { useCurrentLocation } from '../../../hooks/useCurrentLocation';
import { getCountryStateCity } from '../../../utils/countryStateCityLoader';
import {
  findCountryCodeFromGeocodeName,
  findMatchedCityName,
  findMatchedStateNameForCountry,
} from '../../../utils/locationAddressMatch';
import { StorefrontPinIllustration } from '../illustrations/StorefrontPinIllustration';
import { useSignupWizardUi } from '../wizard/SignupWizardUiContext';
import type { SignupFormValues } from '../wizard/types';

export const StoreLocationStep: React.FC = () => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const { postalCodeRequired, signupCountryCodes } = useSignupWizardUi();
  const { module: countryStateCity } = useCountryStateCity();
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormValues>();
  const country = useWatch({ control, name: 'country' }) || '';
  const region = useWatch({ control, name: 'storeLocation.region' }) || '';
  const {
    getCurrentLocation,
    loading: locationLoading,
    error: locationHookError,
  } = useCurrentLocation();
  const [locationBanner, setLocationBanner] = useState<string | null>(null);

  const addressStates = useMemo(
    () =>
      countryStateCity && country
        ? countryStateCity.State.getStatesOfCountry(country)
        : [],
    [countryStateCity, country]
  );

  const selectedStateCode = useMemo(() => {
    if (!region) return '';
    return addressStates.find((s) => s.name === region)?.isoCode ?? '';
  }, [addressStates, region]);

  const addressCities = useMemo(() => {
    if (!countryStateCity || !country || !selectedStateCode) return [];
    return countryStateCity.City.getCitiesOfState(country, selectedStateCode);
  }, [countryStateCity, country, selectedStateCode]);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocationBanner(null);
    try {
      const loc = await getCurrentLocation();
      if (!loc.address) {
        setLocationBanner(
          t(
            'signupPage.locationUnavailable',
            'Could not resolve address from your location.'
          )
        );
        return;
      }
      const countryCode = await findCountryCodeFromGeocodeName(loc.country || '');
      const allowed =
        countryCode &&
        signupCountryCodes.includes(countryCode) &&
        (!country || country === countryCode)
          ? countryCode
          : country || '';
      if (!allowed) {
        setLocationBanner(
          t(
            'signupPage.countryNotSupported',
            'We could not match your country to a supported region. Please choose country and address manually.'
          )
        );
        return;
      }
      const stateName = await findMatchedStateNameForCountry(loc.state, allowed);
      const { State } = await getCountryStateCity();
      const stateIso =
        State.getStatesOfCountry(allowed).find((s) => s.name === stateName)
          ?.isoCode || '';
      const cityName =
        allowed && stateIso
          ? await findMatchedCityName(loc.city, allowed, stateIso)
          : (loc.city || '').trim();

      setValue('storeLocation.street', loc.address || '', { shouldDirty: true });
      if (!country) setValue('country', allowed, { shouldDirty: true });
      setValue('storeLocation.region', stateName || '', { shouldDirty: true });
      setValue('storeLocation.city', cityName || '', { shouldDirty: true });
      if (loc.latitude != null) setValue('storeLocation.latitude', loc.latitude);
      if (loc.longitude != null) setValue('storeLocation.longitude', loc.longitude);
    } catch (e: any) {
      setLocationBanner(
        e?.message ||
          t(
            'signupPage.locationFailed',
            'Unable to get your location. Check permissions and try again.'
          )
      );
    }
  }, [country, getCurrentLocation, setValue, signupCountryCodes, t]);

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <StorefrontPinIllustration />
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
        {t('signupPage.storeLocationTitle', 'Your first store location')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: 1.5, textAlign: 'center' }}
      >
        {t(
          'signupPage.storeLocationHint',
          'This becomes your first business location. You can add more locations later.'
        )}
      </Typography>
      {locationHookError && (
        <Alert severity="warning" sx={{ py: 0.5, borderRadius: 0 }}>
          {locationHookError}
        </Alert>
      )}
      {locationBanner && (
        <Alert
          severity="info"
          onClose={() => setLocationBanner(null)}
          sx={{ py: 0.5, borderRadius: 0 }}
        >
          {locationBanner}
        </Alert>
      )}
      <Button
        fullWidth={isNarrow}
        variant="outlined"
        size="large"
        sx={{ py: 1.25, borderRadius: 0 }}
        startIcon={
          locationLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <MyLocationIcon />
          )
        }
        onClick={handleUseCurrentLocation}
        disabled={locationLoading}
      >
        {t('signupPage.useCurrentLocation', 'Use current location')}
      </Button>
      <Controller
        name="storeLocation.street"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={t('completeProfile.addressLine1', 'Address Line 1')}
            required
            error={Boolean(errors.storeLocation?.street)}
            helperText={errors.storeLocation?.street?.message || ' '}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <HomeOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Controller
        name="storeLocation.region"
        control={control}
        render={({ field }) => (
          <Autocomplete
            fullWidth
            options={addressStates.map((s) => s.name)}
            value={field.value || null}
            onChange={(_, value) => {
              field.onChange(value ?? '');
              setValue('storeLocation.city', '');
            }}
            disabled={!country}
            isOptionEqualToValue={(a, b) => a === b}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('completeProfile.state', 'State / Region')}
                required
                error={Boolean(errors.storeLocation?.region)}
                helperText={errors.storeLocation?.region?.message || ' '}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <MapIcon fontSize="small" color="action" />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}
      />
      <Controller
        name="storeLocation.city"
        control={control}
        render={({ field }) => (
          <Autocomplete
            fullWidth
            freeSolo
            options={addressCities.map((c) => c.name)}
            value={field.value}
            onInputChange={(_, value) => field.onChange(value ?? '')}
            onChange={(_, value) =>
              field.onChange(typeof value === 'string' ? value : value ?? '')
            }
            disabled={!country || !region}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('completeProfile.city', 'City')}
                required
                error={Boolean(errors.storeLocation?.city)}
                helperText={errors.storeLocation?.city?.message || ' '}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <LocationCityIcon fontSize="small" color="action" />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}
      />
      <Controller
        name="storeLocation.postalCode"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={t('completeProfile.postalCode', 'Postal code')}
            required={postalCodeRequired}
            error={Boolean(errors.storeLocation?.postalCode)}
            helperText={errors.storeLocation?.postalCode?.message || ' '}
          />
        )}
      />
    </Stack>
  );
};
