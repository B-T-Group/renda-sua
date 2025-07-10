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
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
} from '../../hooks/useBusinessLocations';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

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

  // Address dialog state
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);

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

    const locationData = {
      ...formData,
      address: addressData,
    };

    console.log('LocationModal: Calling onSave with data:', locationData);
    await onSave(locationData);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleAddressSave = () => {
    setAddressDialogOpen(false);
  };

  const hasAddress =
    addressData.address_line_1 &&
    addressData.city &&
    addressData.state &&
    addressData.country;

  return (
    <>
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

          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('business.locations.locationName')}
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
              required
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: 1, minWidth: 200 }}>
                <InputLabel>{t('business.locations.locationType')}</InputLabel>
                <Select
                  value={formData.location_type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_type: e.target.value,
                    }))
                  }
                  label={t('business.locations.locationType')}
                >
                  <MenuItem value="store">Store</MenuItem>
                  <MenuItem value="warehouse">Warehouse</MenuItem>
                  <MenuItem value="office">Office</MenuItem>
                  <MenuItem value="showroom">Showroom</MenuItem>
                </Select>
              </FormControl>

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
                sx={{ alignSelf: 'center' }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('business.locations.phone')}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                sx={{ flex: 1, minWidth: 200 }}
              />

              <TextField
                label={t('business.locations.email')}
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.locations.address')}
              </Typography>

              {hasAddress ? (
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Current Address:
                  </Typography>
                  <Typography variant="body1">
                    {addressData.address_line_1}
                    {addressData.address_line_2 &&
                      `, ${addressData.address_line_2}`}
                  </Typography>
                  <Typography variant="body1">
                    {addressData.city}, {addressData.state}{' '}
                    {addressData.postal_code}
                  </Typography>
                  <Typography variant="body1">{addressData.country}</Typography>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No address configured. Please add an address for this
                  location.
                </Alert>
              )}

              <Button
                variant="outlined"
                onClick={() => setAddressDialogOpen(true)}
                fullWidth
              >
                {hasAddress ? 'Edit Address' : 'Add Address'}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !hasAddress}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading
              ? t('common.saving')
              : isEditing
              ? t('common.update')
              : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <AddressDialog
        open={addressDialogOpen}
        title={hasAddress ? 'Edit Location Address' : 'Add Location Address'}
        addressData={addressData}
        onClose={() => setAddressDialogOpen(false)}
        onSave={handleAddressSave}
        onAddressChange={setAddressData}
      />
    </>
  );
};

export default LocationModal;
