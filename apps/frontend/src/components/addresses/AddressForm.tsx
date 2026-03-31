import { LocationOn as LocationOnIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { City, Country, State } from 'country-state-city';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import type { AddressFormData } from '../dialogs/AddressDialog';

interface AddressFormProps {
  addressData?: AddressFormData;
  loading?: boolean;
  showAddressType?: boolean;
  showIsPrimary?: boolean;
  showCoordinates?: boolean;
  hideAddressLine2?: boolean;
  hidePostalCode?: boolean;
  addressTypeOptions?: Array<{ value: string; label: string }>;
  /** When set, country is read-only and fixed to this value (e.g. business location = business primary address country). */
  readOnlyCountry?: string | null;
  onAddressChange: (address: AddressFormData) => void;
}

const AddressForm: React.FC<AddressFormProps> = ({
  addressData,
  loading = false,
  showAddressType = true,
  showIsPrimary = true,
  showCoordinates = true,
  hideAddressLine2 = false,
  hidePostalCode = false,
  addressTypeOptions,
  readOnlyCountry = null,
  onAddressChange,
}) => {
  const { t } = useTranslation();

  // Memoize default address type options to avoid recreating on every render
  const defaultAddressTypeOptions = useMemo(
    () => [
      { value: 'home', label: t('addresses.addressTypes.home', 'Home') },
      { value: 'work', label: t('addresses.addressTypes.work', 'Work') },
      {
        value: 'delivery',
        label: t('addresses.addressTypes.delivery', 'Delivery'),
      },
      {
        value: 'billing',
        label: t('addresses.addressTypes.billing', 'Billing'),
      },
    ],
    [t]
  );

  const finalAddressTypeOptions =
    addressTypeOptions || defaultAddressTypeOptions;

  // Location data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countries, setCountries] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [states, setStates] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cities, setCities] = useState<any[]>([]);

  // Current location hook
  const {
    getCurrentLocation,
    loading: locationLoading,
    error: locationError,
  } = useCurrentLocation();

  const normalizeString = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const findBestOptionLabel = (
    raw: string | undefined,
    options: string[]
  ): string => {
    if (!raw) return '';
    const normalizedRaw = normalizeString(raw);
    const exactMatch = options.find(
      // eslint-disable-next-line @typescript-eslint/no-shadow
      (option) => normalizeString(option) === normalizedRaw
    );
    if (exactMatch) return exactMatch;
    const partialMatch = options.find((option) => {
      const normalizedOption = normalizeString(option);
      return (
        normalizedOption.includes(normalizedRaw) ||
        normalizedRaw.includes(normalizedOption)
      );
    });
    return partialMatch || raw;
  };

  // Helper function to find country code by name
  const findCountryCode = (countryName: string): string => {
    if (!countryName) return '';

    // Try exact match first
    const exactMatch = Country.getAllCountries().find(
      (country) => country.name.toLowerCase() === countryName.toLowerCase()
    );
    if (exactMatch) return exactMatch.isoCode;

    // Try partial match
    const partialMatch = Country.getAllCountries().find(
      (country) =>
        country.name.toLowerCase().includes(countryName.toLowerCase()) ||
        countryName.toLowerCase().includes(country.name.toLowerCase())
    );
    if (partialMatch) return partialMatch.isoCode;

    // Try common name variations
    const commonNames: { [key: string]: string } = {
      'united states': 'US',
      usa: 'US',
      'united states of america': 'US',
      canada: 'CA',
      'united kingdom': 'GB',
      uk: 'GB',
      'great britain': 'GB',
      france: 'FR',
      germany: 'DE',
      spain: 'ES',
      italy: 'IT',
      japan: 'JP',
      china: 'CN',
      india: 'IN',
      brazil: 'BR',
      australia: 'AU',
      nigeria: 'NG',
      kenya: 'KE',
      uganda: 'UG',
      tanzania: 'TZ',
      ghana: 'GH',
      'south africa': 'ZA',
      ethiopia: 'ET',
      egypt: 'EG',
      morocco: 'MA',
      algeria: 'DZ',
      tunisia: 'TN',
      libya: 'LY',
      sudan: 'SD',
      'south sudan': 'SS',
      chad: 'TD',
      niger: 'NE',
      mali: 'ML',
      'burkina faso': 'BF',
      senegal: 'SN',
      guinea: 'GN',
      'sierra leone': 'SL',
      liberia: 'LR',
      'ivory coast': 'CI',
      "cote d'ivoire": 'CI',
      benin: 'BJ',
      togo: 'TG',
      cameroon: 'CM',
      'central african republic': 'CF',
      'equatorial guinea': 'GQ',
      gabon: 'GA',
      congo: 'CG',
      'democratic republic of the congo': 'CD',
      'democratic republic of congo': 'CD',
      drc: 'CD',
      angola: 'AO',
      zambia: 'ZM',
      zimbabwe: 'ZW',
      botswana: 'BW',
      namibia: 'NA',
      lesotho: 'LS',
      eswatini: 'SZ',
      swaziland: 'SZ',
      mozambique: 'MZ',
      madagascar: 'MG',
      mauritius: 'MU',
      seychelles: 'SC',
      comoros: 'KM',
      djibouti: 'DJ',
      somalia: 'SO',
      eritrea: 'ER',
      burundi: 'BI',
      rwanda: 'RW',
    };

    const normalizedName = countryName.toLowerCase().trim();
    return commonNames[normalizedName] || '';
  };

  // Helper function to find state code by name and country code
  const findStateCode = (stateName: string, countryCode: string): string => {
    if (!stateName || !countryCode) return '';
    const stateList = State.getStatesOfCountry(countryCode);
    if (!stateList.length) return '';

    const exactMatch = stateList.find(
      (state) => state.name.toLowerCase() === stateName.toLowerCase()
    );
    if (exactMatch) return exactMatch.isoCode;

    const codeMatch = stateList.find(
      (state) => state.isoCode.toLowerCase() === stateName.toLowerCase()
    );
    if (codeMatch) return codeMatch.isoCode;

    const partialMatch = stateList.find(
      (state) =>
        state.name.toLowerCase().includes(stateName.toLowerCase()) ||
        stateName.toLowerCase().includes(state.name.toLowerCase())
    );
    return partialMatch?.isoCode || '';
  };

  const handleGetCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();

      if (location.address) {
        const countryCode = findCountryCode(location.country || '');

        const matchedState =
          countryCode && location.state
            ? findBestOptionLabel(
                location.state,
                State.getStatesOfCountry(countryCode).map((state) => state.name)
              )
            : location.state || '';

        let matchedCity = location.city || '';
        if (countryCode && matchedState) {
          const stateCodeForCities = findStateCode(matchedState, countryCode);
          if (stateCodeForCities) {
            matchedCity = findBestOptionLabel(
              location.city,
              City.getCitiesOfState(countryCode, stateCodeForCities).map(
                (city) => city.name
              )
            );
          }
        }

        onAddressChange({
          address_line_1: location.address || '',
          address_line_2: addressData?.address_line_2 || '',
          city: matchedCity,
          state: matchedState,
          country: countryCode,
          postal_code: location.postalCode || '',
          address_type: addressData?.address_type || 'home',
          is_primary: addressData?.is_primary || false,
          latitude: location.latitude,
          longitude: location.longitude,
          instructions: addressData?.instructions,
        });
      } else {
        onAddressChange({
          address_line_1: addressData?.address_line_1 || '',
          address_line_2: addressData?.address_line_2 || '',
          city: addressData?.city || '',
          state: addressData?.state || '',
          postal_code: addressData?.postal_code || '',
          country: addressData?.country || '',
          address_type: addressData?.address_type || 'home',
          is_primary: addressData?.is_primary || false,
          latitude: addressData?.latitude,
          longitude: addressData?.longitude,
          instructions: addressData?.instructions,
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  useEffect(() => {
    if (addressData?.country) {
      const newStates = State.getStatesOfCountry(addressData.country);
      setStates(newStates);
      if (
        newStates.length > 0 &&
        !newStates.find((state) => state.name === addressData.state)
      ) {
        onAddressChange({
          address_line_1: addressData?.address_line_1 || '',
          address_line_2: addressData?.address_line_2 || '',
          city: addressData?.city || '',
          state: '',
          postal_code: addressData?.postal_code || '',
          country: addressData?.country || '',
          address_type: addressData?.address_type || 'home',
          is_primary: addressData?.is_primary || false,
          latitude: addressData?.latitude,
          longitude: addressData?.longitude,
          instructions: addressData?.instructions,
        });
      }
    } else {
      setStates([]);
      setCities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData?.country, addressData?.state]);

  useEffect(() => {
    if (addressData?.country && addressData?.state) {
      const stateCode = findStateCode(addressData.state, addressData.country);
      if (stateCode) {
        const newCities = City.getCitiesOfState(addressData.country, stateCode);
        setCities(newCities);
        if (
          newCities.length > 0 &&
          !newCities.find((city) => city.name === addressData.city)
        ) {
          onAddressChange({
            address_line_1: addressData?.address_line_1 || '',
            address_line_2: addressData?.address_line_2 || '',
            city: '',
            state: addressData?.state || '',
            postal_code: addressData?.postal_code || '',
            country: addressData?.country || '',
            address_type: addressData?.address_type || 'home',
            is_primary: addressData?.is_primary || false,
            latitude: addressData?.latitude,
            longitude: addressData?.longitude,
            instructions: addressData?.instructions,
          });
        }
      } else {
        setCities([]);
      }
    } else {
      setCities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData?.country, addressData?.state, addressData?.city]);

  const handleInputChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (field: keyof AddressFormData, value: any) => {
      const country = readOnlyCountry ?? addressData?.country ?? '';
      onAddressChange({
        address_line_1: addressData?.address_line_1 || '',
        address_line_2: addressData?.address_line_2 || '',
        city: addressData?.city || '',
        state: addressData?.state || '',
        postal_code: addressData?.postal_code || '',
        country: field === 'country' && !readOnlyCountry ? value : country,
        address_type: addressData?.address_type || 'home',
        is_primary: addressData?.is_primary || false,
        latitude: addressData?.latitude,
        longitude: addressData?.longitude,
        instructions: addressData?.instructions,
        [field]: value,
      });
    },
    [addressData, onAddressChange, readOnlyCountry]
  );

  return (
    <>
      {/* Get Current Location Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          onClick={handleGetCurrentLocation}
          disabled={loading || locationLoading}
          startIcon={
            locationLoading ? (
              <CircularProgress size={16} />
            ) : (
              <LocationOnIcon />
            )
          }
          fullWidth
        >
          {locationLoading
            ? t('addresses.gettingLocation', 'Getting Location...')
            : t('addresses.getCurrentLocation', 'Get Current Location')}
        </Button>
        {locationError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2">{locationError}</Typography>
          </Alert>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
          mt: 1,
        }}
      >
        <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
          <TextField
            fullWidth
            label={t(
              'addresses.addressDialog.addressLine1',
              'Address Line 1'
            )}
            value={addressData?.address_line_1 || ''}
            onChange={(e) => handleInputChange('address_line_1', e.target.value)}
            required
            disabled={loading}
          />
        </Box>

        {!hideAddressLine2 && (
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <TextField
              fullWidth
              label={t(
                'addresses.addressDialog.addressLine2',
                'Address Line 2 (Optional)'
              )}
              value={addressData?.address_line_2 || ''}
              onChange={(e) =>
                handleInputChange('address_line_2', e.target.value)
              }
              disabled={loading}
            />
          </Box>
        )}

        <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={3}
            label={t(
              'addresses.addressDialog.instructionsLabel',
              'How to find this location (optional)'
            )}
            placeholder={t(
              'addresses.instructionsPlaceholder',
              'E.g. landmarks, building name, floor, or extra directions to help locate this address'
            )}
            value={addressData?.instructions || ''}
            onChange={(e) => handleInputChange('instructions', e.target.value)}
            disabled={loading}
          />
        </Box>

        <FormControl fullWidth required disabled={!!readOnlyCountry || loading}>
          <InputLabel>{t('addresses.addressDialog.country', 'Country')}</InputLabel>
          <Select
            value={readOnlyCountry ?? addressData?.country ?? ''}
            onChange={(e) => handleInputChange('country', e.target.value)}
            label={t('addresses.addressDialog.country', 'Country')}
          >
            {countries.map((country) => (
              <MenuItem key={country.isoCode} value={country.isoCode}>
                {country.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth required disabled={loading}>
          <InputLabel>
            {t('addresses.addressDialog.stateProvince', 'State/Province')}
          </InputLabel>
          <Select
            value={addressData?.state || ''}
            onChange={(e) => handleInputChange('state', e.target.value)}
            label={t('addresses.addressDialog.stateProvince', 'State/Province')}
            disabled={!addressData?.country || loading}
          >
            {states.map((state) => (
              <MenuItem key={state.isoCode} value={state.name}>
                {state.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth required disabled={loading}>
          <InputLabel>{t('addresses.addressDialog.city', 'City')}</InputLabel>
          <Select
            value={addressData?.city || ''}
            onChange={(e) => handleInputChange('city', e.target.value)}
            label={t('addresses.addressDialog.city', 'City')}
            disabled={!addressData?.state || loading}
          >
            {cities.map((city) => (
              <MenuItem key={city.name} value={city.name}>
                {city.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!hidePostalCode && (
          <TextField
            fullWidth
            label={t(
              'addresses.addressDialog.postalCodeOptional',
              'Postal code (optional)'
            )}
            value={addressData?.postal_code || ''}
            onChange={(e) => handleInputChange('postal_code', e.target.value)}
            disabled={loading}
          />
        )}

        {showAddressType && (
          <FormControl fullWidth disabled={loading}>
            <InputLabel>
              {t('addresses.addressDialog.addressType', 'Address Type')}
            </InputLabel>
            <Select
              value={addressData?.address_type || ''}
              onChange={(e) => handleInputChange('address_type', e.target.value)}
              label={t('addresses.addressDialog.addressType', 'Address Type')}
            >
              {finalAddressTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {showIsPrimary && (
          <FormControl fullWidth disabled={loading}>
            <InputLabel>
              {t('addresses.addressDialog.primaryAddress', 'Primary Address')}
            </InputLabel>
            <Select
              value={(addressData?.is_primary ?? false).toString()}
              onChange={(e) =>
                handleInputChange('is_primary', e.target.value === 'true')
              }
              label={t('addresses.addressDialog.primaryAddress', 'Primary Address')}
            >
              <MenuItem value="true">
                {t('addresses.addressDialog.yes', 'Yes')}
              </MenuItem>
              <MenuItem value="false">
                {t('addresses.addressDialog.no', 'No')}
              </MenuItem>
            </Select>
          </FormControl>
        )}

        {showCoordinates && (
          <>
            <TextField
              fullWidth
              label={t('addresses.addressDialog.latitude', 'Latitude (Optional)')}
              type="number"
              inputProps={{ step: 'any' }}
              value={addressData?.latitude ?? ''}
              onChange={(e) =>
                handleInputChange(
                  'latitude',
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder="e.g., 40.7128"
              disabled={loading}
            />
            <TextField
              fullWidth
              label={t(
                'addresses.addressDialog.longitude',
                'Longitude (Optional)'
              )}
              type="number"
              inputProps={{ step: 'any' }}
              value={addressData?.longitude ?? ''}
              onChange={(e) =>
                handleInputChange(
                  'longitude',
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder="e.g., -74.0060"
              disabled={loading}
            />
          </>
        )}
      </Box>
    </>
  );
};

export default AddressForm;

