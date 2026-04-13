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
import AddressForm from '../addresses/AddressForm';

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
  instructions?: string;
}

interface AddressDialogProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  addressData?: AddressFormData;
  loading?: boolean;
  showAddressType?: boolean;
  showIsPrimary?: boolean;
  showCoordinates?: boolean;
  hideAddressLine2?: boolean;
  hidePostalCode?: boolean;
  addressTypeOptions?: Array<{ value: string; label: string }>;
  /** Use full-screen dialog on small viewports (e.g. mobile) for better UX */
  fullScreen?: boolean;
  /** When set, country is read-only and fixed to this value (e.g. business location = business primary address country). */
  readOnlyCountry?: string | null;
  /** Nudge to use device location for delivery address accuracy. */
  recommendCurrentLocation?: boolean;
  onClose: () => void;
  onSave: () => void;
  onAddressChange: (address: AddressFormData) => void;
}

const AddressDialog: React.FC<AddressDialogProps> = ({
  open,
  title,
  subtitle,
  addressData,
  loading = false,
  showAddressType = true,
  showIsPrimary = true,
  showCoordinates = true,
  hideAddressLine2 = false,
  hidePostalCode = false,
  addressTypeOptions,
  fullScreen = false,
  readOnlyCountry = null,
  recommendCurrentLocation = false,
  onClose,
  onSave,
  onAddressChange,
}) => {
  const { t } = useTranslation();
  const dialogTitle =
    title || t('addresses.addressDialog.defaultTitle', 'Address');

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
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        <AddressForm
          addressData={addressData}
          loading={loading}
          showAddressType={showAddressType}
          showIsPrimary={showIsPrimary}
          showCoordinates={showCoordinates}
          hideAddressLine2={hideAddressLine2}
          hidePostalCode={hidePostalCode}
          addressTypeOptions={addressTypeOptions}
          readOnlyCountry={readOnlyCountry}
          recommendCurrentLocation={recommendCurrentLocation}
          onAddressChange={onAddressChange}
        />
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
