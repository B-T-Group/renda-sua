import { LocationOn } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Button,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { AddressFormData } from '../dialogs/AddressDialog';
import AddressDialog from '../dialogs/AddressDialog';

const INITIAL_FORM: AddressFormData = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  address_type: 'home',
  is_primary: true,
};

interface AddressAlertProps {
  show?: boolean;
  variant?: 'standard' | 'filled' | 'outlined';
  severity?: 'warning' | 'info' | 'error';
  sx?: any;
}

const AddressAlert: React.FC<AddressAlertProps> = ({
  show = true,
  variant = 'standard',
  severity = 'warning',
  sx = {},
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { profile, userType, addAddress } = useUserProfileContext();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addressFormData, setAddressFormData] = useState<AddressFormData>(
    () => ({ ...INITIAL_FORM })
  );
  const [saving, setSaving] = useState(false);

  const hasAddresses = profile?.addresses && profile.addresses.length > 0;
  const profileId =
    userType === 'client'
      ? profile?.client?.id
      : userType === 'agent'
        ? profile?.agent?.id
        : userType === 'business'
          ? profile?.business?.id
          : null;

  const canAddAddress = !!userType && !!profileId;

  const handleOpenDialog = useCallback(() => {
    setAddressFormData({ ...INITIAL_FORM });
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (!saving) setDialogOpen(false);
  }, [saving]);

  const handleSave = useCallback(async () => {
    if (!userType || !profileId) return;
    const { address_line_1, city, country, state } = addressFormData;
    if (!address_line_1?.trim() || !city?.trim() || !country?.trim() || !state?.trim()) {
      enqueueSnackbar(t('addresses.addressDialog.requiredFields', 'Please fill in all required fields (address, city, state, country).'), {
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      const success = await addAddress(
        {
          ...addressFormData,
          address_line_1: address_line_1.trim(),
          address_line_2: addressFormData.address_line_2?.trim() || '',
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          postal_code: addressFormData.postal_code?.trim() || '',
          address_type: addressFormData.address_type || 'home',
          is_primary: addressFormData.is_primary ?? true,
        },
        userType,
        profileId
      );
      if (success) {
        setDialogOpen(false);
      } else {
        enqueueSnackbar(t('addresses.saveError', 'Failed to save address. Please try again.'), {
          variant: 'error',
        });
      }
    } catch {
      enqueueSnackbar(t('addresses.saveError', 'Failed to save address. Please try again.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [addressFormData, userType, profileId, addAddress, enqueueSnackbar, t]);

  if (!show) return null;
  if (hasAddresses) return null;
  if (!canAddAddress) return null;

  return (
    <>
      <Alert
        severity={severity}
        variant={variant}
        icon={<LocationOn />}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleOpenDialog}
            sx={{ fontWeight: 600 }}
          >
            {t('addresses.addAddress')}
          </Button>
        }
        sx={{
          mb: 3,
          '& .MuiAlert-message': {
            width: '100%',
          },
          ...sx,
        }}
      >
        <AlertTitle sx={{ fontWeight: 600 }}>
          {t('addresses.missingAddressTitle')}
        </AlertTitle>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t('addresses.missingAddressMessage')}
        </Typography>
      </Alert>

      <AddressDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        addressData={addressFormData}
        onAddressChange={setAddressFormData}
        loading={saving}
        title={t('addresses.addAddress')}
        fullScreen={isMobile}
      />
    </>
  );
};

export default AddressAlert;
