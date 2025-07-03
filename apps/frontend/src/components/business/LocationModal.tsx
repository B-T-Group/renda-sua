import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { City, Country, State } from 'country-state-city';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
} from '../../hooks/useBusinessLocations';

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: AddBusinessLocationData | UpdateBusinessLocationData
  ) => Promise<void>;
  location?: BusinessLocation | null;
  loading?: boolean;
  error?: string | null;
}

interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  onSave,
  location,
  loading = false,
  error = null,
}) => {
  const { t } = useTranslation();
  const isEditing = !!location;

  // Form states
  const [formData, setFormData] = useState<AddBusinessLocationData>({
    name: '',
    address_id: '',
    phone: '',
    email: '',
    location_type: 'store',
    is_primary: false,
  });

  const [addressData, setAddressData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });

  // Location data
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Load countries on component mount
  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  // Update states when country changes
  useEffect(() => {
    if (addressData.country) {
      setStates(State.getStatesOfCountry(addressData.country));
      setAddressData((prev) => ({ ...prev, state: '', city: '' }));
    }
  }, [addressData.country]);

  // Update cities when state changes
  useEffect(() => {
    if (addressData.country && addressData.state) {
      setCities(City.getCitiesOfState(addressData.country, addressData.state));
      setAddressData((prev) => ({ ...prev, city: '' }));
    }
  }, [addressData.country, addressData.state]);

  // Load location data when editing
  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name,
        address_id: location.address.id,
        phone: location.phone || '',
        email: location.email || '',
        location_type: location.location_type,
        is_primary: location.is_primary,
      });

      setAddressData({
        address_line_1: location.address.address_line_1,
        address_line_2: location.address.address_line_2 || '',
        city: location.address.city,
        state: location.address.state,
        postal_code: location.address.postal_code,
        country: location.address.country,
      });
    } else {
      // Reset form for new location
      setFormData({
        name: '',
        address_id: '',
        phone: '',
        email: '',
        location_type: 'store',
        is_primary: false,
      });

      setAddressData({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      });
    }
  }, [location, open]);

  const handleSave = async () => {
    console.log('LocationModal: handleSave called');
    console.log('LocationModal: formData:', formData);
    console.log('LocationModal: addressData:', addressData);

    // Validate required fields
    if (!formData.name.trim()) {
      console.log('LocationModal: Name is required');
      return;
    }

    if (
      !addressData.address_line_1.trim() ||
      !addressData.city.trim() ||
      !addressData.state.trim() ||
      !addressData.postal_code.trim() ||
      !addressData.country.trim()
    ) {
      console.log('LocationModal: Address fields are required');
      return;
    }

    // For now, we'll use a placeholder address_id since we need to create the address first
    // In a real implementation, you'd create the address first, then the location
    const locationData = {
      ...formData,
      address: addressData, // Include address data for backend processing
    };

    console.log('LocationModal: Calling onSave with data:', locationData);
    await onSave(locationData);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing
          ? t('business.locations.editLocation')
          : t('business.locations.addLocation')}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container direction="column" spacing={2} sx={{ mt: 1 }}>
          {/* Location Name */}
          <Grid item>
            <TextField
              fullWidth
              label={t('business.locations.name')}
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </Grid>

          {/* Location Type */}
          <Grid item>
            <FormControl fullWidth>
              <InputLabel>{t('business.locations.locationType')}</InputLabel>
              <Select
                value={formData.location_type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    location_type: e.target.value as any,
                  }))
                }
                label={t('business.locations.locationType')}
              >
                <MenuItem value="store">
                  {t('business.locations.store')}
                </MenuItem>
                <MenuItem value="warehouse">
                  {t('business.locations.warehouse')}
                </MenuItem>
                <MenuItem value="office">
                  {t('business.locations.office')}
                </MenuItem>
                <MenuItem value="pickup_point">
                  {t('business.locations.pickupPoint')}
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Primary Location */}
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_primary}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_primary: e.target.checked,
                    }))
                  }
                />
              }
              label={t('business.locations.isPrimary')}
            />
          </Grid>

          {/* Phone */}
          <Grid item>
            <TextField
              fullWidth
              label={t('business.locations.phone')}
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </Grid>

          {/* Email */}
          <Grid item>
            <TextField
              fullWidth
              label={t('business.locations.email')}
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </Grid>

          {/* Address Section */}
          <Grid item>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              {t('business.locations.address')}
            </Typography>
          </Grid>

          {/* Address Line 1 */}
          <Grid item>
            <TextField
              fullWidth
              label="Address Line 1"
              value={addressData.address_line_1}
              onChange={(e) =>
                setAddressData((prev) => ({
                  ...prev,
                  address_line_1: e.target.value,
                }))
              }
              required
            />
          </Grid>

          {/* Address Line 2 */}
          <Grid item>
            <TextField
              fullWidth
              label="Address Line 2 (Optional)"
              value={addressData.address_line_2}
              onChange={(e) =>
                setAddressData((prev) => ({
                  ...prev,
                  address_line_2: e.target.value,
                }))
              }
            />
          </Grid>

          {/* Country */}
          <Grid item>
            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={addressData.country}
                onChange={(e) =>
                  setAddressData((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                label="Country"
                required
              >
                {countries.map((country) => (
                  <MenuItem key={country.isoCode} value={country.isoCode}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* State/Province */}
          <Grid item>
            <FormControl fullWidth>
              <InputLabel>State/Province</InputLabel>
              <Select
                value={addressData.state}
                onChange={(e) =>
                  setAddressData((prev) => ({ ...prev, state: e.target.value }))
                }
                label="State/Province"
                required
                disabled={!addressData.country}
              >
                {states.map((state) => (
                  <MenuItem key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* City */}
          <Grid item>
            <FormControl fullWidth>
              <InputLabel>City</InputLabel>
              <Select
                value={addressData.city}
                onChange={(e) =>
                  setAddressData((prev) => ({ ...prev, city: e.target.value }))
                }
                label="City"
                required
                disabled={!addressData.state}
              >
                {cities.map((city) => (
                  <MenuItem key={city.name} value={city.name}>
                    {city.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Postal Code */}
          <Grid item>
            <TextField
              fullWidth
              label="Postal Code"
              value={addressData.postal_code}
              onChange={(e) =>
                setAddressData((prev) => ({
                  ...prev,
                  postal_code: e.target.value,
                }))
              }
              required
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !formData.name.trim()}
        >
          {loading ? <CircularProgress size={20} /> : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationModal;
