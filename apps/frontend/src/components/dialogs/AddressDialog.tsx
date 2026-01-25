import { LocationOn as LocationOnIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { City, Country, State } from 'country-state-city';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';

export interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type?: string;
  is_primary?: boolean;
  latitude?: number;
  longitude?: number;
}

interface AddressDialogProps {
  open: boolean;
  title?: string;
  addressData?: AddressFormData;
  loading?: boolean;
  showAddressType?: boolean;
  showIsPrimary?: boolean;
  showCoordinates?: boolean;
  addressTypeOptions?: Array<{ value: string; label: string }>;
  /** Use full-screen dialog on small viewports (e.g. mobile) for better UX */
  fullScreen?: boolean;
  onClose: () => void;
  onSave: () => void;
  onAddressChange: (address: AddressFormData) => void;
}

const AddressDialog: React.FC<AddressDialogProps> = ({
  open,
  title,
  addressData,
  loading = false,
  showAddressType = true,
  showIsPrimary = true,
  showCoordinates = true,
  addressTypeOptions,
  fullScreen = false,
  onClose,
  onSave,
  onAddressChange,
}) => {
  const { t } = useTranslation();
  const dialogTitle =
    title || t('addresses.addressDialog.defaultTitle', 'Address');

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
  const [hasPostalCode, setHasPostalCode] = useState<boolean>(
    (addressData?.postal_code ?? '').trim() !== ''
  );

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

  // Helper function to find country code by name
  const findCountryCode = (countryName: string): string => {
    if (!countryName) return '';

    console.log('Finding country code for:', countryName);

    // Try exact match first
    const exactMatch = Country.getAllCountries().find(
      (country) => country.name.toLowerCase() === countryName.toLowerCase()
    );
    if (exactMatch) {
      console.log('Found exact country match:', exactMatch.isoCode);
      return exactMatch.isoCode;
    }

    // Try partial match
    const partialMatch = Country.getAllCountries().find(
      (country) =>
        country.name.toLowerCase().includes(countryName.toLowerCase()) ||
        countryName.toLowerCase().includes(country.name.toLowerCase())
    );
    if (partialMatch) {
      console.log('Found partial country match:', partialMatch.isoCode);
      return partialMatch.isoCode;
    }

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
    const commonMatch = commonNames[normalizedName];
    if (commonMatch) {
      console.log('Found common country name match:', commonMatch);
      return commonMatch;
    }

    console.log('No country code found for:', countryName);
    return '';
  };

  // Helper function to find state code by name and country code
  const findStateCode = (stateName: string, countryCode: string): string => {
    if (!stateName || !countryCode) return '';

    console.log(
      'Finding state code for:',
      stateName,
      'in country:',
      countryCode
    );

    const states = State.getStatesOfCountry(countryCode);
    if (!states.length) {
      console.log('No states found for country:', countryCode);
      return '';
    }

    // Try exact match first (by name)
    const exactMatch = states.find(
      (state) => state.name.toLowerCase() === stateName.toLowerCase()
    );
    if (exactMatch) {
      console.log('Found exact state match:', exactMatch.isoCode);
      return exactMatch.isoCode;
    }

    // Try exact match by isoCode (in case stateName is actually a code)
    const codeMatch = states.find(
      (state) => state.isoCode.toLowerCase() === stateName.toLowerCase()
    );
    if (codeMatch) {
      console.log('Found state code match:', codeMatch.isoCode);
      return codeMatch.isoCode;
    }

    // Try partial match
    const partialMatch = states.find(
      (state) =>
        state.name.toLowerCase().includes(stateName.toLowerCase()) ||
        stateName.toLowerCase().includes(state.name.toLowerCase())
    );
    if (partialMatch) {
      console.log('Found partial state match:', partialMatch.isoCode);
      return partialMatch.isoCode;
    }

    // Try common name variations for US states
    if (countryCode === 'US') {
      const usStateNames: { [key: string]: string } = {
        california: 'CA',
        'new york': 'NY',
        texas: 'TX',
        florida: 'FL',
        illinois: 'IL',
        pennsylvania: 'PA',
        ohio: 'OH',
        georgia: 'GA',
        'north carolina': 'NC',
        michigan: 'MI',
        'new jersey': 'NJ',
        virginia: 'VA',
        washington: 'WA',
        arizona: 'AZ',
        massachusetts: 'MA',
        tennessee: 'TN',
        indiana: 'IN',
        missouri: 'MO',
        maryland: 'MD',
        colorado: 'CO',
        wisconsin: 'WI',
        minnesota: 'MN',
        'south carolina': 'SC',
        alabama: 'AL',
        louisiana: 'LA',
        kentucky: 'KY',
        oregon: 'OR',
        oklahoma: 'OK',
        connecticut: 'CT',
        utah: 'UT',
        nevada: 'NV',
        arkansas: 'AR',
        mississippi: 'MS',
        iowa: 'IA',
        kansas: 'KS',
        idaho: 'ID',
        nebraska: 'NE',
        'west virginia': 'WV',
        'new mexico': 'NM',
        maine: 'ME',
        'new hampshire': 'NH',
        hawaii: 'HI',
        'rhode island': 'RI',
        montana: 'MT',
        delaware: 'DE',
        'south dakota': 'SD',
        'north dakota': 'ND',
        alaska: 'AK',
        vermont: 'VT',
        wyoming: 'WY',
        'district of columbia': 'DC',
        dc: 'DC',
      };

      const normalizedName = stateName.toLowerCase().trim();
      const commonMatch = usStateNames[normalizedName];
      if (commonMatch) {
        console.log('Found common US state name match:', commonMatch);
        return commonMatch;
      }
    }

    console.log(
      'No state code found for:',
      stateName,
      'in country:',
      countryCode
    );
    return '';
  };

  // Handle get current location
  const handleGetCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();

      if (location.address) {
        console.log('Location data received:', location);

        // Convert country name to code
        const countryCode = findCountryCode(location.country || '');

        console.log('Conversion results:', {
          originalCountry: location.country,
          countryCode,
          originalState: location.state,
        });

        // Update the address form with current location data
        onAddressChange({
          address_line_1: location.address || '',
          address_line_2: addressData?.address_line_2 || '',
          city: location.city || '',
          state: location.state || '', // Use state name directly
          country: countryCode, // Use country code instead of name
          postal_code: location.postalCode || '',
          address_type: addressData?.address_type || 'home',
          is_primary: addressData?.is_primary || false,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      } else {
        // If no address but we have coordinates, just update coordinates
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
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  // Load countries on component mount
  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  // Update states when country changes
  useEffect(() => {
    if (addressData?.country) {
      const newStates = State.getStatesOfCountry(addressData.country);
      setStates(newStates);
      // Reset state and city when country changes
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
        });
      }
    } else {
      setStates([]);
      setCities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData?.country, addressData?.state]);

  // Update cities when state changes
  useEffect(() => {
    if (addressData?.country && addressData?.state) {
      // Convert state name to state code for City.getCitiesOfState
      const stateCode = findStateCode(addressData.state, addressData.country);
      if (stateCode) {
        const newCities = City.getCitiesOfState(addressData.country, stateCode);
        setCities(newCities);
        // Reset city when state changes
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
        [field]: value,
      });
    },
    [addressData, onAddressChange]
  );

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        {/* Get Current Location Button */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            onClick={handleGetCurrentLocation}
            disabled={locationLoading}
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
          {/* Ask if user has a postal code */}
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <FormControlLabel
              control={
                <Switch
                  checked={hasPostalCode}
                  onChange={(e) => {
                    const value = e.target.checked;
                    setHasPostalCode(value);
                    if (!value) {
                      onAddressChange({
                        address_line_1: addressData?.address_line_1 || '',
                        address_line_2: addressData?.address_line_2 || '',
                        city: addressData?.city || '',
                        state: addressData?.state || '',
                        postal_code: '',
                        country: addressData?.country || '',
                        address_type: addressData?.address_type || 'home',
                        is_primary: addressData?.is_primary || false,
                        latitude: addressData?.latitude,
                        longitude: addressData?.longitude,
                      });
                    }
                  }}
                />
              }
              label={t(
                'addresses.addressDialog.hasPostalCode',
                'Do you have a postal code?'
              )}
            />
          </Box>
          {/* Address Line 1 */}
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <TextField
              fullWidth
              label={t(
                'addresses.addressDialog.addressLine1',
                'Address Line 1'
              )}
              value={addressData?.address_line_1 || ''}
              onChange={(e) =>
                handleInputChange('address_line_1', e.target.value)
              }
              required
            />
          </Box>

          {/* Address Line 2 */}
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
            />
          </Box>

          {/* Country */}
          <FormControl fullWidth required>
            <InputLabel>
              {t('addresses.addressDialog.country', 'Country')}
            </InputLabel>
            <Select
              value={addressData?.country || ''}
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

          {/* State/Province */}
          <FormControl fullWidth required>
            <InputLabel>
              {t('addresses.addressDialog.stateProvince', 'State/Province')}
            </InputLabel>
            <Select
              value={addressData?.state || ''}
              onChange={(e) => handleInputChange('state', e.target.value)}
              label={t(
                'addresses.addressDialog.stateProvince',
                'State/Province'
              )}
              disabled={!addressData?.country}
            >
              {states.map((state) => (
                <MenuItem key={state.isoCode} value={state.name}>
                  {state.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* City */}
          <FormControl fullWidth required>
            <InputLabel>{t('addresses.addressDialog.city', 'City')}</InputLabel>
            <Select
              value={addressData?.city || ''}
              onChange={(e) => handleInputChange('city', e.target.value)}
              label={t('addresses.addressDialog.city', 'City')}
              disabled={!addressData?.state}
            >
              {cities.map((city) => (
                <MenuItem key={city.name} value={city.name}>
                  {city.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Postal Code */}
          {hasPostalCode ? (
            <TextField
              fullWidth
              label={t('addresses.addressDialog.postalCode', 'Postal Code')}
              value={addressData?.postal_code || ''}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
            />
          ) : null}

          {/* Address Type (optional) */}
          {showAddressType && (
            <FormControl fullWidth>
              <InputLabel>
                {t('addresses.addressDialog.addressType', 'Address Type')}
              </InputLabel>
              <Select
                value={addressData?.address_type || ''}
                onChange={(e) =>
                  handleInputChange('address_type', e.target.value)
                }
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

          {/* Primary Address (optional) */}
          {showIsPrimary && (
            <FormControl fullWidth>
              <InputLabel>
                {t('addresses.addressDialog.primaryAddress', 'Primary Address')}
              </InputLabel>
              <Select
                value={(addressData?.is_primary ?? false).toString()}
                onChange={(e) =>
                  handleInputChange('is_primary', e.target.value === 'true')
                }
                label={t(
                  'addresses.addressDialog.primaryAddress',
                  'Primary Address'
                )}
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

          {/* Coordinates (optional) */}
          {showCoordinates && (
            <>
              <TextField
                fullWidth
                label={t(
                  'addresses.addressDialog.latitude',
                  'Latitude (Optional)'
                )}
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
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('addresses.addressDialog.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading
            ? t('addresses.addressDialog.saving', 'Saving...')
            : t('addresses.addressDialog.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddressDialog;
