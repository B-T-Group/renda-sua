import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { City, Country, State } from 'country-state-city';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { parseGooglePlaceResult } from '../../utils/addressConverter';
import ErrorBoundary from '../common/ErrorBoundary';
import GooglePlacesAutocomplete from '../common/GooglePlacesAutocomplete';

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
  addressData: AddressFormData;
  loading?: boolean;
  showAddressType?: boolean;
  showIsPrimary?: boolean;
  showCoordinates?: boolean;
  addressTypeOptions?: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: () => void;
  onAddressChange: (address: AddressFormData) => void;
}

const defaultAddressTypeOptions = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'billing', label: 'Billing' },
];

const AddressDialog: React.FC<AddressDialogProps> = ({
  open,
  title = 'Address',
  addressData,
  loading = false,
  showAddressType = true,
  showIsPrimary = true,
  showCoordinates = true,
  addressTypeOptions = defaultAddressTypeOptions,
  onClose,
  onSave,
  onAddressChange,
}) => {
  const { t } = useTranslation();

  // Input mode state
  const [inputMode, setInputMode] = useState<'manual' | 'autocomplete'>(
    'manual'
  );

  // Location data
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Google Places API key from hook
  const googleMapsApiKey = useGoogleMapsApiKey();

  // Handle Google Places selection
  const handlePlaceSelect = (place: any) => {
    try {
      const parsedAddress = parseGooglePlaceResult(place);
      onAddressChange({
        ...addressData,
        ...parsedAddress,
      });
    } catch (error) {
      console.error('Error parsing Google Places result:', error);
    }
  };

  // Load countries on component mount
  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  // Update states when country changes
  useEffect(() => {
    if (addressData.country) {
      setStates(State.getStatesOfCountry(addressData.country));
      // Reset state and city when country changes
      if (
        states.length > 0 &&
        !states.find((state) => state.isoCode === addressData.state)
      ) {
        onAddressChange({ ...addressData, state: '', city: '' });
      }
    } else {
      setStates([]);
      setCities([]);
    }
  }, [addressData.country]);

  // Update cities when state changes
  useEffect(() => {
    if (addressData.country && addressData.state) {
      setCities(City.getCitiesOfState(addressData.country, addressData.state));
      // Reset city when state changes
      if (
        cities.length > 0 &&
        !cities.find((city) => city.name === addressData.city)
      ) {
        onAddressChange({ ...addressData, city: '' });
      }
    } else {
      setCities([]);
    }
  }, [addressData.country, addressData.state]);

  const handleInputChange = (field: keyof AddressFormData, value: any) => {
    onAddressChange({
      ...addressData,
      [field]: value,
    });
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {/* Input Mode Toggle */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('addresses.inputMode', 'Input Mode')}
          </Typography>
          <ToggleButtonGroup
            value={inputMode}
            exclusive
            onChange={(_, newMode) => newMode && setInputMode(newMode)}
            size="small"
          >
            <ToggleButton value="manual">
              {t('addresses.manualInput', 'Manual Input')}
            </ToggleButton>
            <ToggleButton value="autocomplete">
              {t('addresses.googleAutocomplete', 'Google Autocomplete')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mt: 1,
          }}
        >
          {/* Google Places Autocomplete */}
          {inputMode === 'autocomplete' && (
            <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
              {googleMapsApiKey ? (
                <ErrorBoundary>
                  <GooglePlacesAutocomplete
                    fullWidth
                    label={t('addresses.searchAddress', 'Search Address')}
                    value={addressData.address_line_1}
                    onChange={(value) =>
                      handleInputChange('address_line_1', value)
                    }
                    onPlaceSelect={handlePlaceSelect}
                    placeholder={t(
                      'addresses.enterAddressToSearch',
                      'Enter address to search...'
                    )}
                    apiKey={googleMapsApiKey}
                    required
                  />
                </ErrorBoundary>
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Google Maps API key is not configured. Please set the
                    REACT_APP_GOOGLE_MAPS_API_KEY environment variable to enable
                    address autocomplete.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Address Line 1 */}
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <TextField
              fullWidth
              label="Address Line 1"
              value={addressData.address_line_1}
              onChange={(e) =>
                handleInputChange('address_line_1', e.target.value)
              }
              required
              disabled={inputMode === 'autocomplete'}
            />
          </Box>

          {/* Address Line 2 */}
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <TextField
              fullWidth
              label="Address Line 2 (Optional)"
              value={addressData.address_line_2}
              onChange={(e) =>
                handleInputChange('address_line_2', e.target.value)
              }
            />
          </Box>

          {/* Country */}
          <FormControl fullWidth required>
            <InputLabel>Country</InputLabel>
            <Select
              value={addressData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              label="Country"
              disabled={inputMode === 'autocomplete'}
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
            <InputLabel>State/Province</InputLabel>
            <Select
              value={addressData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              label="State/Province"
              disabled={!addressData.country || inputMode === 'autocomplete'}
            >
              {states.map((state) => (
                <MenuItem key={state.isoCode} value={state.isoCode}>
                  {state.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* City */}
          <FormControl fullWidth required>
            <InputLabel>City</InputLabel>
            <Select
              value={addressData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              label="City"
              disabled={!addressData.state || inputMode === 'autocomplete'}
            >
              {cities.map((city) => (
                <MenuItem key={city.name} value={city.name}>
                  {city.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Postal Code */}
          <TextField
            fullWidth
            label="Postal Code"
            value={addressData.postal_code}
            onChange={(e) => handleInputChange('postal_code', e.target.value)}
            required
            disabled={inputMode === 'autocomplete'}
          />

          {/* Address Type (optional) */}
          {showAddressType && (
            <FormControl fullWidth>
              <InputLabel>Address Type</InputLabel>
              <Select
                value={addressData.address_type || ''}
                onChange={(e) =>
                  handleInputChange('address_type', e.target.value)
                }
                label="Address Type"
              >
                {addressTypeOptions.map((option) => (
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
              <InputLabel>Primary Address</InputLabel>
              <Select
                value={(addressData.is_primary ?? false).toString()}
                onChange={(e) =>
                  handleInputChange('is_primary', e.target.value === 'true')
                }
                label="Primary Address"
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Coordinates (optional) */}
          {showCoordinates && (
            <>
              <TextField
                fullWidth
                label="Latitude (Optional)"
                type="number"
                inputProps={{ step: 'any' }}
                value={addressData.latitude ?? ''}
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
                label="Longitude (Optional)"
                type="number"
                inputProps={{ step: 'any' }}
                value={addressData.longitude ?? ''}
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
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={loading || !addressData.address_line_1.trim()}
        >
          {loading ? 'Saving...' : 'Save Address'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddressDialog;
