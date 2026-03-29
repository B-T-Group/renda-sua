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
import { State } from 'country-state-city';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Address } from '../../contexts/UserProfileContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
} from '../../hooks/useBusinessLocations';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

function profileAddressToFormData(addr: Address): AddressFormData {
  const state = State.getStateByCodeAndCountry(addr.state, addr.country);
  return {
    address_line_1: addr.address_line_1,
    address_line_2: addr.address_line_2 || '',
    city: addr.city,
    state: state?.name ?? addr.state,
    postal_code: addr.postal_code,
    country: addr.country,
    instructions: addr.instructions || '',
  };
}

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: AddBusinessLocationData | UpdateBusinessLocationData
  ) => Promise<void>;
  location?: BusinessLocation | null;
  /** Business primary address country. When set, country is read-only and derived from business address. */
  businessPrimaryCountry?: string | null;
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
}

const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  onSave,
  location,
  businessPrimaryCountry = null,
  loading = false,
  error = null,
  warning = null,
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const isEditing = !!location;
  const effectiveCountry = isEditing
    ? location?.address?.country
    : businessPrimaryCountry;

  const businessProfileAddress = useMemo(() => {
    const list = profile?.addresses;
    if (!list?.length) return null;
    return list.find((a) => a.is_primary) ?? list[0];
  }, [profile?.addresses]);

  const [reuseProfileAddress, setReuseProfileAddress] = useState(false);

  // Form states
  const [formData, setFormData] = useState<AddBusinessLocationData>({
    name: '',
    address_id: '',
    phone: '',
    email: '',
    location_type: 'store',
    is_primary: false,
    rendasua_item_commission_percentage: null,
  });

  const [addressData, setAddressData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    instructions: '',
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
        rendasua_item_commission_percentage:
          location.rendasua_item_commission_percentage ?? null,
      });

      // Special case to account for legacy state values in the database not saved as state name but saved as state code
      const state = State.getStateByCodeAndCountry(
        location.address.state,
        location.address.country
      );

      setAddressData({
        address_line_1: location.address.address_line_1,
        address_line_2: location.address.address_line_2 || '',
        city: location.address.city,
        state: state?.name ?? location.address.state,
        postal_code: location.address.postal_code,
        country: location.address.country,
        instructions: location.address.instructions || '',
      });
    } else {
      // Reset form for new location; country comes from business primary address
      setFormData({
        name: '',
        address_id: '',
        phone: '',
        email: '',
        location_type: 'store',
        is_primary: false,
        rendasua_item_commission_percentage: null,
      });

      setAddressData({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        postal_code: '',
        country: businessPrimaryCountry ?? '',
        instructions: '',
      });
      setReuseProfileAddress(false);
    }
  }, [location, open, businessPrimaryCountry]);

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const commission = formData.rendasua_item_commission_percentage ?? null;

    if (isEditing) {
      if (
        !addressData.address_line_1.trim() ||
        !addressData.city.trim() ||
        !addressData.state.trim() ||
        !addressData.country.trim()
      ) {
        return;
      }
      await onSave({
        ...formData,
        rendasua_item_commission_percentage: commission,
        address: {
          ...addressData,
          postal_code: addressData.postal_code?.trim() || '',
          state: addressData.state?.trim() || undefined,
          address_line_2: addressData.address_line_2?.trim() || undefined,
        },
      });
      return;
    }

    if (reuseProfileAddress && formData.address_id) {
      await onSave({
        ...formData,
        rendasua_item_commission_percentage: commission,
      });
      return;
    }

    if (
      !addressData.address_line_1.trim() ||
      !addressData.city.trim() ||
      !addressData.state.trim() ||
      !addressData.country.trim()
    ) {
      return;
    }

    await onSave({
      ...formData,
      rendasua_item_commission_percentage: commission,
      address: {
        ...addressData,
        postal_code: addressData.postal_code?.trim() || '',
        state: addressData.state?.trim() || undefined,
        address_line_2: addressData.address_line_2?.trim() || undefined,
      },
    });
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleAddressSave = () => {
    setReuseProfileAddress(false);
    setFormData((prev) => ({ ...prev, address_id: '' }));
    setAddressDialogOpen(false);
  };

  const applyBusinessProfileAddress = () => {
    if (!businessProfileAddress) return;
    setReuseProfileAddress(true);
    setFormData((prev) => ({
      ...prev,
      address_id: businessProfileAddress.id,
    }));
    setAddressData(profileAddressToFormData(businessProfileAddress));
  };

  const openCustomAddressDialog = () => {
    setReuseProfileAddress(false);
    setFormData((prev) => ({ ...prev, address_id: '' }));
    setAddressData({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: businessPrimaryCountry ?? '',
      instructions: '',
    });
    setAddressDialogOpen(true);
  };

  const hasAddress =
    !!(addressData.address_line_1 && addressData.city && addressData.country);
  const canSaveAddress =
    isEditing ||
    (reuseProfileAddress && !!formData.address_id) ||
    hasAddress;

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
          {warning && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {warning}
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

            <TextField
              label={t('business.locations.commissionLabel', 'RendaSua commission')}
              type="number"
              value={formData.rendasua_item_commission_percentage ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                const num = v === '' ? null : parseFloat(v);
                setFormData((prev) => ({
                  ...prev,
                  rendasua_item_commission_percentage:
                    num != null && !Number.isNaN(num) ? num : null,
                }));
              }}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              helperText={t(
                'business.locations.commissionHelper',
                'Percentage of item sales that goes to RendaSua. Leave empty to use the platform default (5%).'
              )}
              fullWidth
              sx={{ maxWidth: 240 }}
            />

            <Box>
              <Typography variant="h6" gutterBottom>
                {t('business.locations.address')}
              </Typography>

              {effectiveCountry && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t('business.locations.countryReadOnly', 'Country is set from your business address and cannot be changed.')}:{' '}
                  <strong>{effectiveCountry}</strong>
                </Typography>
              )}

              {hasAddress ? (
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  {reuseProfileAddress && !isEditing && (
                    <Typography
                      variant="caption"
                      color="primary"
                      display="block"
                      sx={{ mb: 1, fontWeight: 600 }}
                    >
                      {t(
                        'business.locations.usingBusinessProfileAddress',
                        'Using your business profile address'
                      )}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t('business.locations.currentAddress', 'Current address')}
                  </Typography>
                  <Typography variant="body1">
                    {addressData.address_line_1}
                    {addressData.address_line_2 &&
                      `, ${addressData.address_line_2}`}
                  </Typography>
                  <Typography variant="body1">
                    {addressData.city}
                    {addressData.state && `, ${addressData.state}`}{' '}
                    {addressData.postal_code}
                  </Typography>
                  <Typography variant="body1">{addressData.country}</Typography>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t(
                    'business.locations.noLocationAddressHint',
                    'No address configured. Add a location-specific address or reuse your business profile address.'
                  )}
                </Alert>
              )}

              <Stack spacing={1}>
                {!isEditing && businessProfileAddress && (
                  <Button
                    variant="outlined"
                    onClick={applyBusinessProfileAddress}
                    fullWidth
                  >
                    {t(
                      'business.locations.useBusinessProfileAddress',
                      'Use business profile address'
                    )}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (isEditing) {
                      setAddressDialogOpen(true);
                      return;
                    }
                    if (hasAddress && !reuseProfileAddress) {
                      setAddressDialogOpen(true);
                      return;
                    }
                    openCustomAddressDialog();
                  }}
                  fullWidth
                >
                  {isEditing || (hasAddress && !reuseProfileAddress)
                    ? t('business.locations.editAddress', 'Edit address')
                    : t('business.locations.addAddress', 'Add address')}
                </Button>
                {!isEditing && reuseProfileAddress && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={openCustomAddressDialog}
                  >
                    {t(
                      'business.locations.useDifferentAddress',
                      'Use a different address instead'
                    )}
                  </Button>
                )}
              </Stack>
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
            disabled={loading || !canSaveAddress}
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
        title={
          hasAddress
            ? t('business.locations.editLocationAddress', 'Edit location address')
            : t('business.locations.addLocationAddress', 'Add location address')
        }
        addressData={addressData}
        readOnlyCountry={effectiveCountry || undefined}
        onClose={() => setAddressDialogOpen(false)}
        onSave={handleAddressSave}
        onAddressChange={setAddressData}
      />
    </>
  );
};

export default LocationModal;
